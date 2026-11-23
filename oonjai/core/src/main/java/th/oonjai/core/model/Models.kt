package th.oonjai.core.model

import com.google.firebase.Timestamp

/** elders/{elderId} */
data class Elder(
    val id: String = "",
    val name: String = "",
    val caregivers: List<String> = emptyList(),
    /** uid ของเครื่องผู้สูงอายุ — null = ยังไม่จับคู่ */
    val elderUid: String? = null,
    val pairedAt: Timestamp? = null,
    val homeGeofence: Geofence? = null,
    val deviceStatus: DeviceStatus? = null,
)

data class Geofence(val lat: Double = 0.0, val lng: Double = 0.0, val radiusM: Double = 200.0)

data class DeviceStatus(
    val battery: Int? = null,
    val charging: Boolean = false,
    val lastHeartbeat: Timestamp? = null,
    val lat: Double? = null,
    val lng: Double? = null,
)

/** elders/{elderId}/medications/{id} */
data class Medication(
    val id: String = "",
    val name: String = "",
    val dose: String = "",
    /** "HH:mm" เช่น ["08:00","20:00"] */
    val times: List<String> = emptyList(),
    val note: String = "",
    val active: Boolean = true,
)

/** elders/{elderId}/events/{id} */
data class ElderEvent(
    val id: String = "",
    val type: String = "",
    val level: String = EventLevel.INFO,
    val message: String = "",
    val timestamp: Timestamp? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val resolved: Boolean = false,
)

object EventLevel {
    const val URGENT = "urgent"   // ด่วน: หกล้ม, ออกนอกพื้นที่
    const val WARNING = "warning" // เตือน: ขาดยา, แบตต่ำ, ขาดการติดต่อ
    const val WATCH = "watch"     // เฝ้าระวัง: AI riskCheck
    const val INFO = "info"       // ปกติ/สรุป
}

object EventType {
    const val PAIRED = "paired"
    const val MED_TAKEN = "med_taken"
    const val MED_MISSED = "med_missed"
    const val FALL = "fall"
    const val GEOFENCE_EXIT = "geofence_exit"
    const val BATTERY_LOW = "battery_low"
    const val OFFLINE = "offline"
    const val DAILY_SUMMARY = "daily_summary"
    const val RISK = "risk"
}

/** pairingCodes/{code} */
data class PairingCode(
    val elderId: String = "",
    val createdBy: String = "",
    val expiresAt: Timestamp? = null,
)
