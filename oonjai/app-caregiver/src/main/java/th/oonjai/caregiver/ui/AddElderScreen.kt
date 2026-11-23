package th.oonjai.caregiver.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import th.oonjai.core.data.PairingRepository

@Composable
fun AddElderScreen(onCreated: (elderId: String, code: String) -> Unit) {
    val scope = rememberCoroutineScope()
    val repo = remember { PairingRepository() }
    var name by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("เพิ่มผู้สูงอายุ", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(name, { name = it }, label = { Text("ชื่อเรียก เช่น แม่สมศรี") },
            singleLine = true, modifier = Modifier.fillMaxWidth())
        Button(
            onClick = {
                busy = true; error = null
                scope.launch {
                    try { val (id, code) = repo.createElder(name.trim()); onCreated(id, code) }
                    catch (e: Exception) { error = "สร้างไม่สำเร็จ: ${e.message}" }
                    finally { busy = false }
                }
            },
            enabled = !busy && name.isNotBlank(), modifier = Modifier.fillMaxWidth(),
        ) { Text(if (busy) "กำลังสร้าง..." else "สร้างและรับรหัสจับคู่") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}
