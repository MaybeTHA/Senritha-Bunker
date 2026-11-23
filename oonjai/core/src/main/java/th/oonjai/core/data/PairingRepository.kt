package th.oonjai.core.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import th.oonjai.core.model.Elder
import th.oonjai.core.model.EventLevel
import th.oonjai.core.model.EventType
import kotlin.random.Random

class PairingException(message: String) : Exception(message)

class PairingRepository(private val db: FirebaseFirestore = FirebaseFirestore.getInstance()) {

    companion object {
        const val CODE_TTL_MS = 30 * 60 * 1000L // รหัสใช้ได้ 30 นาที
        /** QR เก็บข้อความรูปแบบนี้ */
        fun qrPayload(code: String) = "oonjai:$code"
        fun parseQr(raw: String): String? =
            raw.removePrefix("oonjai:").trim().takeIf { it.length == 6 && it.all(Char::isDigit) }
    }

    /** ผู้ดูแล: สร้างโปรไฟล์ผู้สูงอายุ + รหัสจับคู่ คืนค่า (elderId, code) */
    suspend fun createElder(name: String): Pair<String, String> {
        val uid = OonjaiFirebase.ensureSignedIn()
        val elderRef = db.collection("elders").document()
        elderRef.set(
            mapOf(
                "name" to name,
                "caregivers" to listOf(uid),
                "elderUid" to null,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        db.collection("caregivers").document(uid)
            .set(mapOf("elders" to FieldValue.arrayUnion(elderRef.id)), SetOptions.merge()).await()
        return elderRef.id to newCode(elderRef.id)
    }

    /** ผู้ดูแล: ออกรหัสใหม่ให้ผู้สูงอายุเดิม (เช่น เปลี่ยนเครื่อง) */
    suspend fun newCode(elderId: String): String {
        val uid = OonjaiFirebase.ensureSignedIn()
        repeat(5) {
            val code = Random.nextInt(0, 1_000_000).toString().padStart(6, '0')
            val ref = db.collection("pairingCodes").document(code)
            val created = db.runTransaction { tx ->
                if (tx.get(ref).exists()) false else {
                    tx.set(ref, mapOf(
                        "elderId" to elderId,
                        "createdBy" to uid,
                        "expiresAt" to Timestamp(java.util.Date(System.currentTimeMillis() + CODE_TTL_MS)),
                    ))
                    true
                }
            }.await()
            if (created) return code
        }
        throw PairingException("สร้างรหัสไม่สำเร็จ ลองใหม่อีกครั้ง")
    }

    /** เครื่องผู้สูงอายุ: ใช้รหัสจับคู่ คืนค่า elderId */
    suspend fun claim(code: String): String {
        val uid = OonjaiFirebase.ensureSignedIn()
        val snap = db.collection("pairingCodes").document(code).get().await()
        if (!snap.exists()) throw PairingException("ไม่พบรหัสนี้ ตรวจสอบอีกครั้ง")
        val elderId = snap.getString("elderId")!!
        val exp = snap.getTimestamp("expiresAt")
        if (exp == null || exp.toDate().time < System.currentTimeMillis())
            throw PairingException("รหัสหมดอายุแล้ว ให้ผู้ดูแลสร้างรหัสใหม่")
        try {
            db.collection("elders").document(elderId).update(
                mapOf(
                    "elderUid" to uid,
                    "pairCode" to code,
                    "pairedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
        } catch (e: Exception) {
            throw PairingException("จับคู่ไม่สำเร็จ (ผู้สูงอายุคนนี้อาจจับคู่กับเครื่องอื่นแล้ว)")
        }
        db.collection("elders").document(elderId).collection("events").add(
            mapOf(
                "type" to EventType.PAIRED,
                "level" to EventLevel.INFO,
                "message" to "จับคู่เครื่องผู้สูงอายุสำเร็จ",
                "timestamp" to FieldValue.serverTimestamp(),
                "resolved" to true,
            )
        ).await()
        return elderId
    }

    fun observeElder(elderId: String): Flow<Elder?> = callbackFlow {
        val reg = db.collection("elders").document(elderId).addSnapshotListener { s, _ ->
            trySend(s?.toObject(Elder::class.java)?.copy(id = s.id))
        }
        awaitClose { reg.remove() }
    }

    fun observeMyElders(uid: String): Flow<List<Elder>> = callbackFlow {
        val reg = db.collection("elders").whereArrayContains("caregivers", uid)
            .addSnapshotListener { s, _ ->
                trySend(s?.documents?.mapNotNull { d -> d.toObject(Elder::class.java)?.copy(id = d.id) }
                    ?: emptyList())
            }
        awaitClose { reg.remove() }
    }
}
