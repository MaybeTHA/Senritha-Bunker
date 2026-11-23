plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services) apply false
}
// ใช้ Firebase เฉพาะเมื่อวางไฟล์ google-services.json ไว้ในโฟลเดอร์นี้แล้ว
// (ไม่มีไฟล์ก็ build ได้ แอปจะขึ้นหน้าบอกวิธีตั้งค่า)
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
android {
    namespace = "th.oonjai.caregiver"
    compileSdk = 35
    defaultConfig {
        applicationId = "th.oonjai.caregiver"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // hackathon: เซ็นด้วย debug key เพื่อให้ติดตั้ง APK ได้เลย
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}
dependencies {
    implementation(project(":core"))
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.compose.tooling)
    implementation(libs.zxing.core)
    implementation(libs.firebase.messaging)
}
