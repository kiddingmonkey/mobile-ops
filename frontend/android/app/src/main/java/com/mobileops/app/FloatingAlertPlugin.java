package com.mobileops.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatingAlert")
public class FloatingAlertPlugin extends Plugin {

    private WindowManager windowManager;
    private View floatingView;

    @PluginMethod
    public void checkPermission(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        boolean hasPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            hasPermission = Settings.canDrawOverlays(activity);
        }

        JSObject ret = new JSObject();
        ret.put("granted", hasPermission);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(activity)) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, 100);
                call.resolve();
                return;
            }
        }

        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showAlert(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        String title = call.getString("title", "告警");
        String message = call.getString("message", "");
        String severity = call.getString("severity", "warning");

        activity.runOnUiThread(() -> {
            try {
                // 移除已有的悬浮窗
                dismissAlert(null);

                // 创建悬浮窗
                windowManager = (WindowManager) activity.getSystemService(Activity.WINDOW_SERVICE);

                // 简单的悬浮窗布局
                floatingView = new TextView(activity);
                TextView textView = (TextView) floatingView;
                textView.setText("🚨 " + title + "\n" + message);
                textView.setTextColor(0xFFFFFFFF);
                textView.setBackgroundColor(severity.equals("critical") ? 0xFFDC3545 : 0xFFFFC107);
                textView.setPadding(40, 30, 40, 30);
                textView.setTextSize(14);
                textView.setGravity(Gravity.CENTER);

                // 点击关闭
                textView.setOnClickListener(v -> dismissAlert(null));

                // 悬浮窗参数
                WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                                : WindowManager.LayoutParams.TYPE_PHONE,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                        PixelFormat.TRANSLUCENT
                );

                params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                params.y = 100;

                windowManager.addView(floatingView, params);

                // 5秒后自动关闭
                textView.postDelayed(() -> dismissAlert(null), 5000);

                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to show floating alert: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void dismissAlert(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            if (call != null) call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            if (floatingView != null && windowManager != null) {
                try {
                    windowManager.removeView(floatingView);
                } catch (Exception ignored) {
                }
                floatingView = null;
            }
            if (call != null) call.resolve();
        });
    }
}
