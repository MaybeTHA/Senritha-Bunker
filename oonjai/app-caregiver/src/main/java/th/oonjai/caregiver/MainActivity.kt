package th.oonjai.caregiver

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import th.oonjai.caregiver.ui.AddElderScreen
import th.oonjai.caregiver.ui.HomeScreen
import th.oonjai.caregiver.ui.PairCodeScreen
import th.oonjai.core.data.OonjaiFirebase
import th.oonjai.core.ui.NotConfiguredScreen
import th.oonjai.core.ui.OonjaiTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val configured = OonjaiFirebase.isConfigured(this)
        setContent {
            OonjaiTheme {
                Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    if (!configured) NotConfiguredScreen("app-caregiver") else App()
                }
            }
        }
    }
}

@Composable
private fun App() {
    var uid by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { uid = OonjaiFirebase.ensureSignedIn() } catch (e: Exception) { error = "เข้าสู่ระบบไม่ได้: ${e.message}" }
    }
    if (uid == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (error != null) Text(error!!) else CircularProgressIndicator()
        }
        return
    }
    val nav = rememberNavController()
    NavHost(nav, startDestination = "home") {
        composable("home") {
            HomeScreen(uid!!, onAdd = { nav.navigate("add") }, onPair = { id -> nav.navigate("pair/$id") })
        }
        composable("add") {
            AddElderScreen(onCreated = { id, code ->
                nav.navigate("pair/$id?code=$code") { popUpTo("home") }
            })
        }
        composable("pair/{id}?code={code}") { e ->
            PairCodeScreen(
                elderId = e.arguments?.getString("id")!!,
                initialCode = e.arguments?.getString("code"),
                onDone = { nav.popBackStack("home", false) },
            )
        }
    }
}
