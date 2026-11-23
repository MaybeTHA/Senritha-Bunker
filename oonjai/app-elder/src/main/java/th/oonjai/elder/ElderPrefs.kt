package th.oonjai.elder

import android.content.Context

/** เก็บสถานะในเครื่อง: ยินยอม PDPA, elderId ที่จับคู่แล้ว */
class ElderPrefs(context: Context) {
    private val sp = context.getSharedPreferences("oonjai_elder", Context.MODE_PRIVATE)
    var consented: Boolean
        get() = sp.getBoolean("consented", false)
        set(v) = sp.edit().putBoolean("consented", v).apply()
    var elderId: String?
        get() = sp.getString("elderId", null)
        set(v) = sp.edit().putString("elderId", v).apply()
}
