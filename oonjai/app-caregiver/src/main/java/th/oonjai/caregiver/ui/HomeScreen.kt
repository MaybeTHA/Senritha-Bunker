package th.oonjai.caregiver.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import th.oonjai.core.data.PairingRepository
import th.oonjai.core.model.Elder
import th.oonjai.core.ui.OkGreen
import th.oonjai.core.ui.WarnAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(uid: String, onAdd: () -> Unit, onPair: (String) -> Unit) {
    val repo = remember { PairingRepository() }
    val elders by repo.observeMyElders(uid).collectAsState(initial = null)
    Scaffold(
        topBar = { TopAppBar(title = { Text("อุ่นใจ ผู้ดูแล") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = onAdd, icon = { Icon(Icons.Default.Add, null) },
                text = { Text("เพิ่มผู้สูงอายุ") })
        },
    ) { pad ->
        when {
            elders == null -> Box(Modifier.padding(pad).fillMaxSize()) { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            elders!!.isEmpty() -> Text(
                "ยังไม่มีผู้สูงอายุ\nกด \"เพิ่มผู้สูงอายุ\" เพื่อเริ่มจับคู่",
                Modifier.padding(pad).padding(24.dp), style = MaterialTheme.typography.titleMedium,
            )
            else -> LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(elders!!, key = { it.id }) { ElderCard(it, onClick = { if (it.elderUid == null) onPair(it.id) }) }
            }
        }
    }
}

@Composable
private fun ElderCard(elder: Elder, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp)) {
            Text(elder.name, style = MaterialTheme.typography.titleLarge)
            if (elder.elderUid == null)
                Text("⏳ ยังไม่จับคู่เครื่อง — แตะเพื่อดูรหัส", color = WarnAmber)
            else
                Text("✅ จับคู่เครื่องแล้ว", color = OkGreen)
        }
    }
}
