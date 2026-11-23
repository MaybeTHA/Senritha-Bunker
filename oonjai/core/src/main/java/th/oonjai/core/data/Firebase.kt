package th.oonjai.core.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

object OonjaiFirebase {
    /** true เมื่อใส่ google-services.json แล้ว */
    fun isConfigured(context: Context): Boolean =
        FirebaseApp.getApps(context).isNotEmpty()

    /** MVP: ใช้ Anonymous Auth ทั้ง 2 แอป */
    suspend fun ensureSignedIn(): String {
        val auth = FirebaseAuth.getInstance()
        auth.currentUser?.let { return it.uid }
        return auth.signInAnonymously().await().user!!.uid
    }
}
