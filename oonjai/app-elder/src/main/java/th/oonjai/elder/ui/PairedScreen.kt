package th.oonjai.elder.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import th.oonjai.core.data.PairingRepository

/** หลังจับคู่ (Phase 2 จะเพิ่มขั้นขอสิทธิ์ + เริ่ม service ตรงนี้) */
@Composable
fun PairedScreen(elderId: String) {
    val repo = remember { PairingRepository() }
    val elder by repo.observeElder(elderId).collectAsState(initial = null)
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("✅", fontSize = 96.sp)
        Text(
            "จับคู่เรียบร้อย" + (elder?.name?.let { "\nสวัสดีค่ะ คุณ$it" } ?: ""),
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "อุ่นใจจะคอยดูแลอยู่เบื้องหลัง\nไม่ต้องเปิดแอปนี้อีก",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )
    }
}
