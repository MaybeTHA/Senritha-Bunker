package th.oonjai.elder.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** หน้ายินยอม PDPA */
@Composable
fun ConsentScreen(onAccept: () -> Unit) {
    var checked by remember { mutableStateOf(false) }
    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("ยินดีต้อนรับสู่ อุ่นใจ", style = MaterialTheme.typography.headlineMedium)
        Text(
            "แอปนี้จะเก็บข้อมูลต่อไปนี้ เพื่อส่งให้ลูกหลานหรือผู้ดูแลที่คุณจับคู่ไว้เท่านั้น:",
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            "• ตำแหน่งของเครื่อง\n• การกินยาตามเวลา\n• การหกล้ม (จากเซนเซอร์)\n• แบตเตอรี่และสถานะเครื่อง\n• เสียงตอบรับตอนเตือนยา (ไม่บันทึกเสียงเก็บไว้)",
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            "ข้อมูลเก็บบน Google Firebase คุณขอลบข้อมูลหรือยกเลิกได้ทุกเมื่อ โดยแจ้งผู้ดูแลหรือถอนการติดตั้งแอป",
            style = MaterialTheme.typography.bodyLarge,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = checked, onCheckedChange = { checked = it })
            Text("ฉันเข้าใจและยินยอม", style = MaterialTheme.typography.bodyLarge)
        }
        Button(
            onClick = onAccept, enabled = checked,
            modifier = Modifier.fillMaxWidth().height(72.dp),
        ) { Text("ยินยอมและไปต่อ") }
    }
}
