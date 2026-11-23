package th.oonjai.core.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** แสดงเมื่อยังไม่ได้ใส่ google-services.json */
@Composable
fun NotConfiguredScreen(folder: String) {
    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("ยังไม่ได้เชื่อม Firebase", style = MaterialTheme.typography.headlineMedium)
        Text(
            "1. ดาวน์โหลดไฟล์ google-services.json จาก Firebase Console\n" +
                "2. วางไว้ในโฟลเดอร์ oonjai/$folder/\n" +
                "3. Build แอปใหม่อีกครั้ง\n\nดูขั้นตอนละเอียดใน oonjai/docs/SETUP.md",
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
