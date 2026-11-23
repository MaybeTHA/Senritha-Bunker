package th.oonjai.core.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp

val WarmOrange = Color(0xFFE8833A)
val UrgentRed = Color(0xFFD32F2F)
val WarnAmber = Color(0xFFF9A825)
val OkGreen = Color(0xFF2E7D32)

private val Light = lightColorScheme(
    primary = WarmOrange, onPrimary = Color.White,
    secondary = Color(0xFF5D7B6F), background = Color(0xFFFFFBF7), surface = Color(0xFFFFFBF7),
)
private val Dark = darkColorScheme(primary = Color(0xFFFFB27A), secondary = Color(0xFFA5C8B8))

/** large = ตัวหนังสือใหญ่สำหรับแอปผู้สูงอายุ */
@Composable
fun OonjaiTheme(large: Boolean = false, content: @Composable () -> Unit) {
    val base = Typography()
    val typo = if (!large) base else base.copy(
        headlineMedium = base.headlineMedium.copy(fontSize = 34.sp, lineHeight = 42.sp),
        titleLarge = base.titleLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
        bodyLarge = TextStyle(fontSize = 24.sp, lineHeight = 34.sp),
        labelLarge = base.labelLarge.copy(fontSize = 24.sp),
    )
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, typography = typo, content = content)
}
