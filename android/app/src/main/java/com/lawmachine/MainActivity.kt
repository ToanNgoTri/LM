package com.lawmachine
import android.os.Bundle;
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory;

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "lawMachine"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */

         override fun onCreate(savedInstanceState: Bundle?) {
      supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
      super.onCreate(savedInstanceState);
      relayoutOnKeyboardChange()
    }

  /**
   * RN chỉ phát keyboardDidShow/keyboardDidHide trong onGlobalLayout. Ở chế độ
   * edge-to-edge (Android 15+) cửa sổ không co lại khi bàn phím bật/tắt nên
   * không có lần layout nào -> JS không nhận keyboardDidHide (thanh tìm kiếm
   * Detail5 kẹt lơ lửng / nằm dưới bàn phím). Ép layout lại khi bàn phím đổi.
   */
  private fun relayoutOnKeyboardChange() {
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setWindowInsetsAnimationCallback(
        content,
        object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
          override fun onProgress(
              insets: WindowInsetsCompat,
              runningAnimations: MutableList<WindowInsetsAnimationCompat>,
          ): WindowInsetsCompat = insets

          override fun onEnd(animation: WindowInsetsAnimationCompat) {
            if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
              content.requestLayout()
            }
          }
        },
    )
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
