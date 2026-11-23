package th.oonjai.elder.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import kotlinx.coroutines.launch
import th.oonjai.core.data.PairingException
import th.oonjai.core.data.PairingRepository

@Composable
fun PairingScreen(onPaired: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repo = remember { PairingRepository() }
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit(c: String) {
        busy = true; error = null
        scope.launch {
            try { onPaired(repo.claim(c)) }
            catch (e: PairingException) { error = e.message }
            catch (e: Exception) { error = "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต" }
            finally { busy = false }
        }
    }

    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("จับคู่กับผู้ดูแล", style = MaterialTheme.typography.headlineMedium)
        Text(
            "เปิดแอป \"อุ่นใจ ผู้ดูแล\" ในเครื่องลูกหลาน กด \"เพิ่มผู้สูงอายุ\" แล้วสแกน QR หรือกรอกรหัส 6 หลัก",
            style = MaterialTheme.typography.bodyLarge,
        )
        Button(
            onClick = {
                val opts = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
                GmsBarcodeScanning.getClient(context, opts).startScan()
                    .addOnSuccessListener { b ->
                        val c = PairingRepository.parseQr(b.rawValue ?: "")
                        if (c == null) error = "QR นี้ไม่ใช่ของอุ่นใจ" else { code = c; submit(c) }
                    }
                    .addOnFailureListener { error = "เปิดกล้องสแกนไม่ได้ ลองกรอกรหัสแทน" }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().height(80.dp),
        ) { Text("📷 สแกน QR") }

        Text("หรือกรอกรหัส", style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(
            value = code,
            onValueChange = { v -> code = v.filter(Char::isDigit).take(6) },
            singleLine = true,
            textStyle = TextStyle(fontSize = 40.sp, letterSpacing = 8.sp, textAlign = TextAlign.Center),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { submit(code) },
            enabled = !busy && code.length == 6,
            modifier = Modifier.fillMaxWidth().height(72.dp),
        ) { Text(if (busy) "กำลังจับคู่..." else "ยืนยันรหัส") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }
    }
}
