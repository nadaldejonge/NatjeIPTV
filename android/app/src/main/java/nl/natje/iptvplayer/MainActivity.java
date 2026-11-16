package nl.natje.iptvplayer;

import android.os.Bundle;
import android.view.KeyEvent;

import androidx.media3.common.util.UnstableApi;

import com.getcapacitor.BridgeActivity;

@UnstableApi
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidTvBridgePlugin.class);
        super.onCreate(savedInstanceState);
        TvPlayerManager.init(this, getBridge().getWebView());
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null && event.getAction() == KeyEvent.ACTION_DOWN && manager.isFullscreen()) {
            // Back: eerst controller verbergen, daarna terug naar mini-player. Nooit de stream stoppen.
            if (event.getKeyCode() == KeyEvent.KEYCODE_BACK && manager.handleBack()) {
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onPause() {
        super.onPause();
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.onActivityPause();
        }
    }

    @Override
    public void onStop() {
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.onActivityStop();
        }
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.onActivityResume();
        }
    }

    @Override
    public void onDestroy() {
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.onActivityDestroy();
        }
        super.onDestroy();
    }
}
