package nl.natje.iptvplayer;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.SharedPreferences;

import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@UnstableApi
@CapacitorPlugin(name = "AndroidTvBridge")
public class AndroidTvBridgePlugin extends Plugin {
    @Override
    public void load() {
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.setEventSink(this::notifyListeners);
        }
    }

    private TvPlayerManager manager() {
        // Lazy koppelen: de manager wordt pas ná de plugin-load geïnitialiseerd in MainActivity.
        TvPlayerManager manager = TvPlayerManager.get();
        if (manager != null) {
            manager.setEventSink(this::notifyListeners);
        }
        return manager;
    }

    @PluginMethod
    public void openPlaylistFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/x-mpegurl", "application/vnd.apple.mpegurl", "text/plain", "application/octet-stream"});
        startActivityForResult(call, intent, "handlePlaylistResult");
    }

    @ActivityCallback
    private void handlePlaylistResult(PluginCall call, Activity activity, Intent data) {
        if (call == null) {
            return;
        }
        if (data == null || data.getData() == null) {
            call.resolve(null);
            return;
        }
        Uri uri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Some providers do not support persistable permissions.
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                call.reject("Playlist kon niet worden geopend.");
                return;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            JSObject result = new JSObject();
            result.put("filePath", displayName(uri));
            result.put("content", buffer.toString(StandardCharsets.UTF_8.name()));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Playlist lezen mislukt: " + error.getMessage());
        }
    }

    private void startPlayback(PluginCall call, boolean fullscreen) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Stream URL ontbreekt.");
            return;
        }
        TvPlayerManager manager = manager();
        if (manager == null) {
            call.reject("Native player is niet geïnitialiseerd.");
            return;
        }
        Map<String, String> headers = new HashMap<>();
        String referer = call.getString("referer", "");
        String cookies = call.getString("cookies", "");
        if (referer != null && !referer.trim().isEmpty()) {
            headers.put("Referer", referer);
        }
        if (cookies != null && !cookies.trim().isEmpty()) {
            headers.put("Cookie", cookies);
        }
        JSObject extraHeaders = call.getObject("headers", new JSObject());
        Iterator<String> keys = extraHeaders.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = extraHeaders.getString(key, "");
            if (value != null && !value.trim().isEmpty()) {
                headers.put(key, value);
            }
        }
        List<String> fallbacks = new ArrayList<>();
        try {
            JSArray array = call.getArray("fallbackUrls", new JSArray());
            for (int index = 0; index < array.length(); index += 1) {
                fallbacks.add(array.getString(index));
            }
        } catch (Exception ignored) {
            // Geen fallback-URL's.
        }
        getActivity().runOnUiThread(() -> {
        try {
        manager.play(
            url,
            Boolean.TRUE.equals(call.getBoolean("isLive", false)),
            BridgeNumbers.asLong(call.getData().opt("startPositionMs"), 0L),
            call.getString("userAgent", "Natjes-IPTV-player/0.1 AndroidTV"),
            headers,
            fallbacks,
            fullscreen,
            BridgeNumbers.asLong(call.getData().opt("requestId"), 0L)
        );
        resolveOk(call);
        } catch (Exception error) {
            call.reject("Native player starten mislukt (" + error.getClass().getSimpleName() + ").");
        }
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        startPlayback(call, true);
    }

    @PluginMethod
    public void playMini(PluginCall call) {
        startPlayback(call, false);
    }

    @PluginMethod
    public void setMiniPlayerBounds(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager == null) {
            resolveOk(call);
            return;
        }
        double ratio = call.getDouble("devicePixelRatio", 1.0);
        int x = (int) Math.round(call.getDouble("x", 0.0) * ratio);
        int y = (int) Math.round(call.getDouble("y", 0.0) * ratio);
        int width = (int) Math.round(call.getDouble("width", 0.0) * ratio);
        int height = (int) Math.round(call.getDouble("height", 0.0) * ratio);
        manager.setMiniBounds(x, y, width, height);
        resolveOk(call);
    }

    @PluginMethod
    public void enterFullscreen(PluginCall call) {
        TvPlayerManager manager = manager();
        getActivity().runOnUiThread(() -> {
            if (manager == null || !manager.hasPlayback()) {
                call.reject("Er is geen actieve stream om fullscreen te openen."); return;
            }
            try { manager.enterFullscreen(); resolveOk(call); }
            catch (Exception error) { call.reject("Fullscreen openen mislukt (" + error.getClass().getSimpleName() + ")."); }
        });
    }

    @PluginMethod
    public void exitFullscreen(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.exitFullscreen();
        }
        resolveOk(call);
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.stopPlayback();
        }
        resolveOk(call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.pause();
        }
        resolveOk(call);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.resume();
        }
        resolveOk(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayback(call);
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.seekTo(BridgeNumbers.asLong(call.getData().opt("positionMs"), 0L));
        }
        resolveOk(call);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager == null) {
            JSObject idle = new JSObject();
            idle.put("state", "idle");
            call.resolve(idle);
            return;
        }
        getActivity().runOnUiThread(() -> call.resolve(manager.currentState()));
    }

    @PluginMethod
    public void getTracks(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager == null) {
            call.resolve(new JSObject());
            return;
        }
        getActivity().runOnUiThread(() -> call.resolve(manager.currentTracks()));
    }

    @PluginMethod
    public void selectAudioTrack(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.selectTrack(call.getString("id", ""), C.TRACK_TYPE_AUDIO);
        }
        resolveOk(call);
    }

    @PluginMethod
    public void selectSubtitleTrack(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.selectTrack(call.getString("id", ""), C.TRACK_TYPE_TEXT);
        }
        resolveOk(call);
    }

    @PluginMethod
    public void disableSubtitles(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager != null) {
            manager.disableSubtitles();
        }
        resolveOk(call);
    }

    @PluginMethod
    public void showSubtitles(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager == null) { call.reject("Native speler is niet beschikbaar."); return; }
        manager.showSubtitleDialog(() -> resolveOk(call));
    }

    @PluginMethod
    public void showAudioTracks(PluginCall call) {
        TvPlayerManager manager = manager();
        if (manager == null) { call.reject("Native speler is niet beschikbaar."); return; }
        manager.showAudioDialog(() -> resolveOk(call));
    }

    // ===== Secure credential storage (Android Keystore-backed) =====

    private SharedPreferences securePrefs() throws Exception {
        MasterKey masterKey = new MasterKey.Builder(getContext())
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build();
        return EncryptedSharedPreferences.create(
            getContext(),
            "natje_secure_credentials",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    @PluginMethod
    public void secureSetCredentials(PluginCall call) {
        try {
            securePrefs().edit()
                .putString("username", call.getString("username", ""))
                .putString("password", call.getString("password", ""))
                .apply();
            resolveOk(call);
        } catch (Exception error) {
            call.reject("Veilige opslag mislukt: " + error.getClass().getSimpleName());
        }
    }

    @PluginMethod
    public void secureGetCredentials(PluginCall call) {
        try {
            SharedPreferences prefs = securePrefs();
            JSObject result = new JSObject();
            result.put("username", prefs.getString("username", ""));
            result.put("password", prefs.getString("password", ""));
            call.resolve(result);
        } catch (Exception error) {
            JSObject empty = new JSObject();
            empty.put("username", "");
            empty.put("password", "");
            call.resolve(empty);
        }
    }

    @PluginMethod
    public void secureClearCredentials(PluginCall call) {
        try {
            securePrefs().edit().clear().apply();
        } catch (Exception ignored) {
            // Niets te wissen of Keystore niet beschikbaar.
        }
        resolveOk(call);
    }

    private void resolveOk(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    private String displayName(Uri uri) {
        try (android.database.Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    return cursor.getString(index);
                }
            }
        } catch (Exception ignored) {
            // Fall back to URI string.
        }
        return uri.toString();
    }
}
