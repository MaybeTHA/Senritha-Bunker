package th.oonjai.caregiver.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import th.oonjai.core.data.PairingRepository
import th.oonjai.core.ui.OkGreen

@Composable
fun PairCodeScreen(elderId: String, initialCode: String?, onDone: () -> Unit) {
    val repo = remember { PairingRepository() }
    var code by remember { mutableStateOf(initialCode) }
    var error by remember { mutableStateOf<String?>(null) }
    val elder by repo.observeElder(elderId).collectAsState(initial = null)
    LaunchedEffect(elderId) {
        if (code == null) try { code = repo.newCode(elderId) } catch (e: Exception) { error = e.message }
    }
    val paired = elder?.elderUid != null

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("จับคู่เครื่อง ${elder?.name ?: ""}", style = MaterialTheme.typography.headlineSmall)
        if (paired) {
            Text("✅ จับคู่สำเร็จ!", color = OkGreen, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Button(onClick = onDone) { Text("เสร็จสิ้น") }
            return@Column
        }
        Text("ในเครื่องผู้สูงอายุ เปิดแอป \"อุ่นใจ ผู้สูงอายุ\" แล้วสแกน QR นี้ หรือกรอกรหัส")
        code?.let { c ->
            val bmp = remember(c) { qrBitmap(PairingRepository.qrPayload(c)) }
            Image(bmp.asImageBitmap(), "QR จับคู่", Modifier.size(260.dp))
            Text(c.chunked(3).joinToString(" "), fontSize = 44.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
            Text("รหัสใช้ได้ 30 นาที", style = MaterialTheme.typography.bodySmall)
        } ?: CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp)); Text("รอเครื่องผู้สูงอายุ...")
        }
    }
}

private fun qrBitmap(text: String, size: Int = 512): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
    val px = IntArray(size * size) { i -> if (m[i % size, i / size]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
    return Bitmap.createBitmap(px, size, size, Bitmap.Config.ARGB_8888)
}
