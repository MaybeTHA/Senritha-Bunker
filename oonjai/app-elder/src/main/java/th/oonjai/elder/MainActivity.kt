package th.oonjai.elder

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import th.oonjai.core.data.OonjaiFirebase
import th.oonjai.core.ui.NotConfiguredScreen
import th.oonjai.core.ui.OonjaiTheme
import th.oonjai.elder.ui.ConsentScreen
import th.oonjai.elder.ui.PairedScreen
import th.oonjai.elder.ui.PairingScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val prefs = ElderPrefs(this)
        val configured = OonjaiFirebase.isConfigured(this)
        setContent {
            OonjaiTheme(large = true) {
                Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    var consented by remember { mutableStateOf(prefs.consented) }
                    var elderId by remember { mutableStateOf(prefs.elderId) }
                    when {
                        !configured -> NotConfiguredScreen("app-elder")
                        !consented -> ConsentScreen { prefs.consented = true; consented = true }
                        elderId == null -> PairingScreen { id -> prefs.elderId = id; elderId = id }
                        else -> PairedScreen(elderId!!)
                    }
                }
            }
        }
    }
}
