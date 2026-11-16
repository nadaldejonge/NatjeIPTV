package nl.natje.iptvplayer;

import android.view.View;
import android.view.ViewGroup;
import android.view.TextureView;
import android.graphics.Bitmap;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.ui.PlayerView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicReference;
import java.io.File;
import java.io.FileOutputStream;
import java.util.HashSet;
import static org.junit.Assert.*;

/** Real Capacitor plugin + Media3, against a local synthetic HLS server; no IPTV account. */
@UnstableApi
@RunWith(AndroidJUnit4.class)
public class NativeMiniPlayerTest {
    private PlayerView findPlayer(View view) {
        if (view instanceof PlayerView) return (PlayerView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                PlayerView found = findPlayer(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test public void integerRequestPlaysPreviewAndFullscreenReusesPlayer() throws Exception {
        AtomicReference<String> state = new AtomicReference<>("idle");
        AtomicReference<String> rejection = new AtomicReference<>();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                TvPlayerManager manager = TvPlayerManager.get();
                manager.setMiniBounds(30, 60, 380, 214);
                AndroidTvBridgePlugin plugin = (AndroidTvBridgePlugin) activity.getBridge().getPlugin("AndroidTvBridge").getInstance();
                JSObject data = new JSObject();
                data.put("url", "http://10.0.2.2:8788/fixture.m3u8");
                data.put("requestId", 1); // JSONObject deliberately stores Integer here.
                data.put("isLive", false);
                PluginCall call = new PluginCall(null, "AndroidTvBridge", "native-test", "playMini", data) {
                    @Override public void resolve(JSObject response) { }
                    @Override public void reject(String message) { rejection.set(message); }
                };
                plugin.playMini(call);
                assertNull(rejection.get());
                assertEquals(1L, manager.currentState().optLong("requestId"));
            });
            for (int i = 0; i < 100; i++) {
                scenario.onActivity(activity -> state.set(TvPlayerManager.get().currentState().optString("state")));
                if ("playing".equals(state.get())) break;
                Thread.sleep(100);
            }
            assertEquals("Native HLS should actually play", "playing", state.get());
            Thread.sleep(400);
            scenario.onActivity(activity -> {
                TvPlayerManager manager = TvPlayerManager.get();
                PlayerView view = findPlayer(activity.findViewById(android.R.id.content));
                assertNotNull(view);
                assertEquals(View.VISIBLE, view.getVisibility());
                assertEquals(380, view.getLayoutParams().width);
                Player player = view.getPlayer();
                assertNotNull(player);
                assertTrue(view.getVideoSurfaceView() instanceof TextureView);
                Bitmap frame = ((TextureView) view.getVideoSurfaceView()).getBitmap();
                assertNotNull("TextureView should contain decoded video", frame);
                HashSet<Integer> colors = new HashSet<>();
                for (int x = 1; x < 8; x++) for (int y = 1; y < 8; y++) colors.add(frame.getPixel(frame.getWidth() * x / 8, frame.getHeight() * y / 8));
                assertTrue("The video frame should not be a blank black preview", colors.size() > 3);
                try (FileOutputStream stream = new FileOutputStream(new File(activity.getExternalFilesDir(null), "native-preview-frame.png"))) {
                    frame.compress(Bitmap.CompressFormat.PNG, 100, stream);
                } catch (Exception error) { throw new AssertionError(error); }
                Object mediaItem = player.getCurrentMediaItem();
                manager.enterFullscreen();
                assertTrue(manager.isFullscreen());
                assertSame(player, view.getPlayer());
                assertSame(mediaItem, player.getCurrentMediaItem());
                manager.exitFullscreen();
                assertFalse(manager.isFullscreen());
                assertSame(player, view.getPlayer());
                assertSame(mediaItem, player.getCurrentMediaItem());
                manager.stopPlayback();
                assertEquals(0, player.getMediaItemCount());
                assertEquals(View.GONE, view.getVisibility());
            });
        }
    }

    @Test public void recreatedActivityGetsItsOwnPlayerManagerAndWebView() {
        AtomicReference<TvPlayerManager> previous = new AtomicReference<>();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> previous.set(TvPlayerManager.get()));
            scenario.recreate();
            scenario.onActivity(activity -> {
                assertNotSame("A manager bound to a destroyed Activity cannot show video", previous.get(), TvPlayerManager.get());
                assertFalse(TvPlayerManager.get().hasPlayback());
            });
        }
    }
}
