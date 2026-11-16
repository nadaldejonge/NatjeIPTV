package nl.natje.iptvplayer;

import android.app.Activity;
import android.net.Uri;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.view.ContextThemeWrapper;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.VideoSize;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.DefaultTrackNameProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;

/**
 * Beheert precies één ExoPlayer + één PlayerView als native overlay boven de
 * Capacitor-WebView. De view wisselt tussen mini-bounds (uit React) en fullscreen
 * zonder de player te releasen, zodat playback ononderbroken doorloopt.
 */
@UnstableApi
public final class TvPlayerManager {
    private static final String TAG = "TvPlayer";
    private static TvPlayerManager instance;

    public interface EventSink {
        void emit(String event, JSObject data);
    }

    public static final String MODE_HIDDEN = "hidden";
    public static final String MODE_MINI = "mini";
    public static final String MODE_FULLSCREEN = "fullscreen";

    private final Activity activity;
    private final View webView;
    private ExoPlayer player;
    private DefaultTrackSelector trackSelector;
    private PlayerView playerView;
    private EventSink eventSink;
    private String mode = MODE_HIDDEN;
    private int playerInstanceId = 0;
    private final int[] miniBounds = new int[]{0, 0, 0, 0};
    private boolean live = false;
    private String activeUrl = "";
    private String userAgent = "Natjes-IPTV-player/0.1 AndroidTV";
    private final List<String> fallbackUrls = new ArrayList<>();
    private int fallbackIndex = 0;
    private long requestId = 0;
    private boolean keepScreenOn = false;
    private String subtitleMode = "auto";
    private AlertDialog activeDialog;

    private TvPlayerManager(Activity activity, View webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public static void init(Activity activity, View webView) {
        if (instance == null || instance.activity != activity || instance.webView != webView) {
            if (instance != null) instance.onActivityDestroy();
            instance = new TvPlayerManager(activity, webView);
        }
    }

    public static TvPlayerManager get() {
        return instance;
    }

    public void setEventSink(EventSink sink) {
        this.eventSink = sink;
    }

    public String getMode() {
        return mode;
    }

    private void emit(String event, JSObject data) {
        data.put("requestId", requestId);
        if (eventSink != null) {
            eventSink.emit(event, data);
        }
    }

    private void ensureView() {
        if (playerView != null) {
            return;
        }
        playerView = (PlayerView) LayoutInflater.from(activity).inflate(R.layout.tv_player_view, null, false);
        playerView.setControllerShowTimeoutMs(4000);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(true);
        playerView.setShowNextButton(false);
        playerView.setShowPreviousButton(false);
        playerView.setShowSubtitleButton(true);
        View settings = playerView.findViewById(androidx.media3.ui.R.id.exo_settings);
        if (settings != null) settings.setOnClickListener(view -> showPlaybackSettings());
        View captions = playerView.findViewById(androidx.media3.ui.R.id.exo_subtitle);
        if (captions != null) captions.setOnClickListener(view -> showSubtitleDialog(null));
        playerView.setVisibility(View.GONE);
        playerView.setFocusable(false);
        activity.addContentView(playerView, new FrameLayout.LayoutParams(0, 0));
        Log.i(TAG, "PlayerView toegevoegd als overlay (TextureView surface)");
    }

    private void ensurePlayer(Map<String, String> headers) {
        if (player != null) {
            return;
        }
        playerInstanceId += 1;
        trackSelector = new DefaultTrackSelector(activity);
        DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true);
        if (headers != null && !headers.isEmpty()) {
            httpFactory.setDefaultRequestProperties(headers);
        }
        player = new ExoPlayer.Builder(activity)
            .setTrackSelector(trackSelector)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(activity).setDataSourceFactory(httpFactory))
            .build();
        Log.i(TAG, "Player instance: " + playerInstanceId);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                emitState();
                updateSeekControls();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                updateKeepScreenOn(isPlaying);
                emitState();
            }

            @Override
            public void onVideoSizeChanged(VideoSize size) {
                JSObject data = new JSObject();
                data.put("width", size.width);
                data.put("height", size.height);
                emit("videoSizeChanged", data);
            }

            @Override
            public void onTracksChanged(Tracks tracks) {
                applyAutomaticDutchSubtitles(tracks);
                emit("tracksChanged", currentTracks());
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Log.w(TAG, "Player error: " + error.getErrorCodeName());
                if (fallbackIndex < fallbackUrls.size()) {
                    String fallback = fallbackUrls.get(fallbackIndex);
                    fallbackIndex += 1;
                    Log.i(TAG, "Fallback URL " + fallbackIndex + " proberen");
                    long position = player.getCurrentPosition();
                    activeUrl = fallback;
                    player.setMediaItem(MediaItem.fromUri(Uri.parse(fallback)));
                    player.prepare();
                    if (!live && position > 0) {
                        player.seekTo(position);
                    }
                    player.play();
                    updateKeepScreenOn(true);
                    return;
                }
                JSObject data = new JSObject();
                data.put("code", error.getErrorCodeName());
                data.put("message", error.getMessage() != null ? error.getMessage() : "Onbekende playerfout");
                Throwable cause = error.getCause();
                data.put("cause", cause != null ? cause.getClass().getSimpleName() + ": " + cause.getMessage() : "");
                emit("playerError", data);
                emitState();
            }
        });
    }

    private void updateSeekControls() {
        if (playerView == null || player == null) {
            return;
        }
        boolean seekable = player.isCurrentMediaItemSeekable();
        playerView.setShowFastForwardButton(seekable);
        playerView.setShowRewindButton(seekable);
    }

    public void play(String url, boolean isLive, long startPositionMs, String userAgent,
                     Map<String, String> headers, List<String> fallbacks, boolean fullscreen, long requestId) {
        activity.runOnUiThread(() -> {
            if (requestId > 0 && requestId < this.requestId) return;
            dismissDialog();
            this.requestId = requestId;
            ensureView();
            if (userAgent != null && !userAgent.trim().isEmpty()) {
                this.userAgent = userAgent;
            }
            if (player == null) {
                ensurePlayer(headers);
            }
            this.live = isLive;
            subtitleMode = "auto";
            this.activeUrl = url;
            this.fallbackUrls.clear();
            if (fallbacks != null) {
                this.fallbackUrls.addAll(fallbacks);
            }
            this.fallbackIndex = 0;
            playerView.setPlayer(null);
            playerView.setPlayer(player);
            Log.i(TAG, "MediaItem change (instance " + playerInstanceId + ", live=" + isLive + ")");
            player.setMediaItem(MediaItem.fromUri(Uri.parse(url)));
            player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !isLive).build());
            player.prepare();
            if (startPositionMs > 0 && !isLive) {
                player.seekTo(startPositionMs);
            }
            player.play();
            updateKeepScreenOn(true);
            if (fullscreen) {
                applyFullscreen();
            } else {
                applyMini();
            }
            emitState();
        });
    }

    public void setMiniBounds(int x, int y, int width, int height) {
        activity.runOnUiThread(() -> {
            miniBounds[0] = x;
            miniBounds[1] = y;
            miniBounds[2] = width;
            miniBounds[3] = height;
            if (MODE_MINI.equals(mode)) {
                applyMini();
            }
        });
    }

    public void enterFullscreen() {
        activity.runOnUiThread(() -> {
            if (player == null) {
                return;
            }
            long before = player.getCurrentPosition();
            applyFullscreen();
            Log.i(TAG, "Mode: MINI -> FULLSCREEN | MediaItem unchanged: true | position: " + before);
        });
    }

    public void exitFullscreen() {
        activity.runOnUiThread(() -> {
            if (player == null) {
                return;
            }
            applyMini();
            Log.i(TAG, "Mode: FULLSCREEN -> MINI | position: " + player.getCurrentPosition());
        });
    }

    private void applyFullscreen() {
        ensureView();
        mode = MODE_FULLSCREEN;
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        playerView.setLayoutParams(params);
        playerView.setVisibility(View.VISIBLE);
        playerView.setKeepScreenOn(true);
        playerView.setUseController(true);
        playerView.setControllerShowTimeoutMs(4000);
        playerView.setFocusable(true);
        playerView.requestFocus();
        playerView.showController();
        updateSeekControls();
        emitMode();
    }

    private void applyMini() {
        ensureView();
        boolean returningFromFullscreen = MODE_FULLSCREEN.equals(mode);
        mode = MODE_MINI;
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(miniBounds[2], miniBounds[3]);
        int[] webOrigin = new int[2];
        int[] parentOrigin = new int[2];
        webView.getLocationInWindow(webOrigin);
        if (playerView.getParent() instanceof View) ((View) playerView.getParent()).getLocationInWindow(parentOrigin);
        params.leftMargin = miniBounds[0] + webOrigin[0] - parentOrigin[0];
        params.topMargin = miniBounds[1] + webOrigin[1] - parentOrigin[1];
        playerView.setLayoutParams(params);
        playerView.setVisibility(miniBounds[2] > 0 && miniBounds[3] > 0 ? View.VISIBLE : View.GONE);
        playerView.setKeepScreenOn(player != null && player.isPlaying());
        playerView.setUseController(false);
        playerView.hideController();
        playerView.setFocusable(false);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        // Bounds and channel updates never transfer focus away from a focused DOM row.
        if (returningFromFullscreen || !webView.hasFocus()) webView.requestFocus();
        emitMode();
    }

    public void stopPlayback() {
        activity.runOnUiThread(() -> {
            dismissDialog();
            if (player != null) {
                player.stop();
                player.clearMediaItems();
            }
            updateKeepScreenOn(false);
            if (playerView != null) {
                playerView.setVisibility(View.GONE);
                playerView.setFocusable(false);
                playerView.setKeepScreenOn(false);
            }
            mode = MODE_HIDDEN;
            activeUrl = "";
            if (!webView.hasFocus()) webView.requestFocus();
            Log.i(TAG, "Playback expliciet gestopt");
            emitMode();
            emitState();
        });
    }

    public void pause() {
        activity.runOnUiThread(() -> {
            if (player != null) {
                player.pause();
                updateKeepScreenOn(false);
            }
        });
    }

    public void resume() {
        activity.runOnUiThread(() -> {
            if (player != null) {
                player.play();
                updateKeepScreenOn(true);
            }
        });
    }

    public void seekTo(long positionMs) {
        activity.runOnUiThread(() -> {
            if (player != null) {
                player.seekTo(positionMs);
            }
        });
    }

    /** Back in fullscreen: controller eerst verbergen, daarna terug naar mini. Retourneert true als afgehandeld. */
    public boolean handleBack() {
        if (!MODE_FULLSCREEN.equals(mode)) {
            return false;
        }
        if (playerView != null && playerView.isControllerFullyVisible()) {
            playerView.hideController();
            return true;
        }
        exitFullscreen();
        return true;
    }

    public boolean isFullscreen() {
        return MODE_FULLSCREEN.equals(mode);
    }

    public boolean hasPlayback() {
        return player != null && !activeUrl.isEmpty();
    }

    public void onActivityPause() {
        if (player != null) {
            player.pause();
        }
        updateKeepScreenOn(false);
    }

    public void onActivityStop() {
        if (player != null) {
            player.pause();
        }
        updateKeepScreenOn(false);
        if (playerView != null) {
            playerView.setVisibility(View.GONE);
            playerView.setPlayer(null);
            playerView.setKeepScreenOn(false);
        }
    }

    public void onActivityResume() {
        activity.runOnUiThread(() -> {
            if (player == null || playerView == null) {
                return;
            }
            playerView.setPlayer(null);
            playerView.setPlayer(player);
            updateKeepScreenOn(player.isPlaying());
            if (MODE_FULLSCREEN.equals(mode)) {
                applyFullscreen();
            } else if (MODE_MINI.equals(mode)) {
                applyMini();
            }
            emitState();
        });
    }

    public void onActivityDestroy() {
        dismissDialog();
        updateKeepScreenOn(false);
        if (player != null) {
            player.release();
            player = null;
            Log.i(TAG, "Player released (activity destroy)");
        }
    }

    private void updateKeepScreenOn(boolean enabled) {
        if (keepScreenOn == enabled) {
            return;
        }
        keepScreenOn = enabled;
        activity.runOnUiThread(() -> {
            if (enabled) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            if (playerView != null) {
                playerView.setKeepScreenOn(enabled);
            }
        });
    }

    private void emitMode() {
        JSObject data = new JSObject();
        data.put("mode", mode);
        emit("playerModeChanged", data);
    }

    private void emitState() {
        emit("playerStateChanged", currentState());
    }

    public JSObject currentState() {
        JSObject object = new JSObject();
        object.put("requestId", requestId);
        if (player == null) {
            object.put("state", "idle");
            object.put("positionMs", 0);
            object.put("durationMs", 0);
            object.put("bufferedPositionMs", 0);
            object.put("isLive", false);
            object.put("mode", mode);
            return object;
        }
        String state;
        int playbackState = player.getPlaybackState();
        if (playbackState == Player.STATE_IDLE) {
            state = player.getPlayerError() != null ? "error" : "idle";
        } else if (playbackState == Player.STATE_BUFFERING) {
            state = "buffering";
        } else if (playbackState == Player.STATE_ENDED) {
            state = "ended";
        } else {
            state = player.isPlaying() ? "playing" : "paused";
        }
        object.put("state", state);
        object.put("positionMs", player.getCurrentPosition());
        object.put("durationMs", player.getDuration() == C.TIME_UNSET ? 0 : player.getDuration());
        object.put("bufferedPositionMs", player.getBufferedPosition());
        object.put("isLive", live);
        object.put("isSeekable", player.isCurrentMediaItemSeekable());
        object.put("mode", mode);
        return object;
    }

    public JSObject currentTracks() {
        JSObject object = new JSObject();
        object.put("subtitleMode", subtitleMode);
        JSArray audio = new JSArray();
        JSArray subtitles = new JSArray();
        if (player != null) {
            Tracks tracks = player.getCurrentTracks();
            int groupIndex = 0;
            for (Tracks.Group group : tracks.getGroups()) {
                int type = group.getType();
                TrackGroup mediaGroup = group.getMediaTrackGroup();
                for (int trackIndex = 0; trackIndex < mediaGroup.length; trackIndex += 1) {
                    JSObject track = new JSObject();
                    track.put("id", groupIndex + ":" + trackIndex);
                    track.put("label", trackLabel(mediaGroup.getFormat(trackIndex)));
                    track.put("language", mediaGroup.getFormat(trackIndex).language);
                    track.put("mimeType", mediaGroup.getFormat(trackIndex).sampleMimeType);
                    track.put("selected", group.isTrackSelected(trackIndex));
                    track.put("supported", group.isTrackSupported(trackIndex));
                    if (type == C.TRACK_TYPE_AUDIO) {
                        audio.put(track);
                    } else if (type == C.TRACK_TYPE_TEXT) {
                        subtitles.put(track);
                    }
                }
                groupIndex += 1;
            }
        }
        object.put("audioTracks", audio);
        object.put("subtitleTracks", subtitles);
        return object;
    }

    public void selectTrack(String id, int trackType) {
        activity.runOnUiThread(() -> {
            if (player == null || id == null || !id.contains(":")) {
                return;
            }
            try {
                String[] parts = id.split(":");
                int groupIndex = Integer.parseInt(parts[0]);
                int trackIndex = Integer.parseInt(parts[1]);
                Tracks tracks = player.getCurrentTracks();
                if (groupIndex < 0 || groupIndex >= tracks.getGroups().size()) {
                    return;
                }
                Tracks.Group group = tracks.getGroups().get(groupIndex);
                if (group.getType() != trackType || trackIndex < 0 || trackIndex >= group.length || !group.isTrackSupported(trackIndex)) return;
                if (trackType == C.TRACK_TYPE_TEXT) subtitleMode = "manual";
                player.setTrackSelectionParameters(
                    player.getTrackSelectionParameters().buildUpon()
                        .setTrackTypeDisabled(trackType, false)
                        .clearOverridesOfType(trackType)
                        .setOverrideForType(new TrackSelectionOverride(group.getMediaTrackGroup(), trackIndex))
                        .build()
                );
                emit("tracksChanged", currentTracks());
            } catch (Exception error) {
                Log.w(TAG, "Trackselectie mislukt: " + error.getMessage());
            }
        });
    }

    public void disableSubtitles() {
        activity.runOnUiThread(() -> {
            if (player == null) {
                return;
            }
            subtitleMode = "off";
            player.setTrackSelectionParameters(
                player.getTrackSelectionParameters().buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
            );
            emit("tracksChanged", currentTracks());
        });
    }

    private void applyAutomaticDutchSubtitles(Tracks tracks) {
        if (player == null || live || !"auto".equals(subtitleMode)) return;
        Tracks.Group best = null;
        int bestIndex = -1, bestScore = -1;
        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() != C.TRACK_TYPE_TEXT) continue;
            for (int index = 0; index < group.length; index++) {
                if (!group.isTrackSupported(index)) continue;
                int score = SubtitlePolicy.score(group.getTrackFormat(index));
                if (score > bestScore) { best = group; bestIndex = index; bestScore = score; }
            }
        }
        boolean disabled = player.getTrackSelectionParameters().disabledTrackTypes.contains(C.TRACK_TYPE_TEXT);
        if (best == null) {
            if (!disabled) player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_TEXT).setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build());
        } else if (disabled || !best.isTrackSelected(bestIndex)) {
            player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_TEXT).setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(new TrackSelectionOverride(best.getMediaTrackGroup(), bestIndex)).build());
        }
    }

    public void useAutomaticSubtitles() {
        activity.runOnUiThread(() -> {
            if (player == null) return;
            subtitleMode = "auto";
            applyAutomaticDutchSubtitles(player.getCurrentTracks());
            emit("tracksChanged", currentTracks());
        });
    }

    private String trackLabel(Format format) {
        String label = new DefaultTrackNameProvider(activity.getResources()).getTrackName(format);
        if (format.label != null && !format.label.isEmpty() && !label.contains(format.label)) label += " · " + format.label;
        String language = format.language;
        if (language != null && !language.equals("und")) {
            String name = new Locale(language.split("[-_]", 2)[0]).getDisplayLanguage(new Locale("nl"));
            if (SubtitlePolicy.isDutch(language, null)) name = "Nederlands";
            if (label == null || label.isEmpty()) label = name;
            else if (!label.toLowerCase(Locale.ROOT).contains(name.toLowerCase(Locale.ROOT))) label = name + " · " + label;
        }
        if ((format.selectionFlags & C.SELECTION_FLAG_FORCED) != 0 && !label.toLowerCase(Locale.ROOT).contains("forced")) label += " · Forced";
        if ((format.roleFlags & C.ROLE_FLAG_DESCRIBES_MUSIC_AND_SOUND) != 0 && !label.toLowerCase(Locale.ROOT).contains("sdh")) label += " · SDH";
        return label == null || label.isEmpty() ? "Onbekende taal" : label;
    }

    private AlertDialog.Builder dialogBuilder(String title) {
        return new AlertDialog.Builder(new ContextThemeWrapper(activity, R.style.NatjePlayerDialog)).setTitle(title).setNegativeButton("Sluiten", null);
    }

    private void dismissDialog() {
        if (activeDialog != null) { AlertDialog dialog = activeDialog; activeDialog = null; dialog.dismiss(); }
    }

    private void showDialog(AlertDialog dialog, Runnable onClosed) {
        dismissDialog();
        View previousFocus = activity.getCurrentFocus();
        activeDialog = dialog;
        if (playerView != null && MODE_FULLSCREEN.equals(mode)) playerView.setControllerShowTimeoutMs(0);
        dialog.setOnDismissListener(ignored -> {
            if (activeDialog == dialog) activeDialog = null;
            if (playerView != null && MODE_FULLSCREEN.equals(mode)) {
                playerView.setControllerShowTimeoutMs(4000); playerView.showController();
                if (previousFocus != null && previousFocus.isAttachedToWindow()) previousFocus.requestFocus();
            } else if (activeDialog == null) webView.requestFocus();
            if (onClosed != null) onClosed.run();
        });
        dialog.show();
        int checked = dialog.getListView().getCheckedItemPosition();
        if (checked >= 0) dialog.getListView().setSelection(checked);
        dialog.getListView().requestFocus();
    }

    public void showSubtitleDialog(Runnable onClosed) {
        activity.runOnUiThread(() -> {
            if (!hasPlayback()) { if (onClosed != null) onClosed.run(); return; }
            final long dialogRequest = requestId;
            List<String> labels = new ArrayList<>(), ids = new ArrayList<>();
            labels.add("Automatisch · Nederlands"); ids.add("auto");
            labels.add("Uit"); ids.add("off");
            int checked = "auto".equals(subtitleMode) ? 0 : "off".equals(subtitleMode) ? 1 : -1;
            int groupIndex = 0;
            for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
                if (group.getType() == C.TRACK_TYPE_TEXT) for (int index = 0; index < group.length; index++) {
                    if (!group.isTrackSupported(index)) continue;
                    if ("manual".equals(subtitleMode) && group.isTrackSelected(index)) checked = labels.size();
                    labels.add(trackLabel(group.getTrackFormat(index))); ids.add(groupIndex + ":" + index);
                }
                groupIndex++;
            }
            AlertDialog.Builder builder = dialogBuilder(labels.size() > 2 ? "Ondertiteling" : "Ondertiteling · geen sporen beschikbaar");
            builder.setSingleChoiceItems(labels.toArray(new String[0]), checked, (dialog, index) -> {
                if (requestId == dialogRequest) {
                    if (index == 0) useAutomaticSubtitles();
                    else if (index == 1) disableSubtitles();
                    else selectTrack(ids.get(index), C.TRACK_TYPE_TEXT);
                }
                dialog.dismiss();
            });
            showDialog(builder.create(), onClosed);
        });
    }

    public void showAudioDialog(Runnable onClosed) {
        activity.runOnUiThread(() -> {
            if (!hasPlayback()) { if (onClosed != null) onClosed.run(); return; }
            final long dialogRequest = requestId;
            List<String> labels = new ArrayList<>(), ids = new ArrayList<>();
            labels.add("Automatisch"); ids.add("auto");
            boolean overridden = player.getTrackSelectionParameters().overrides.values().stream().anyMatch(item -> item.getType() == C.TRACK_TYPE_AUDIO);
            int checked = overridden ? -1 : 0, groupIndex = 0;
            for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
                if (group.getType() == C.TRACK_TYPE_AUDIO) for (int index = 0; index < group.length; index++) {
                    if (!group.isTrackSupported(index)) continue;
                    if (overridden && group.isTrackSelected(index)) checked = labels.size();
                    labels.add(trackLabel(group.getTrackFormat(index))); ids.add(groupIndex + ":" + index);
                }
                groupIndex++;
            }
            AlertDialog.Builder builder = dialogBuilder(labels.size() > 1 ? "Audiotaal" : "Audiotaal · geen sporen beschikbaar");
            builder.setSingleChoiceItems(labels.toArray(new String[0]), checked, (dialog, index) -> {
                if (requestId == dialogRequest) {
                    if (index == 0) player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                        .clearOverridesOfType(C.TRACK_TYPE_AUDIO).setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false).build());
                    else selectTrack(ids.get(index), C.TRACK_TYPE_AUDIO);
                }
                dialog.dismiss();
            });
            showDialog(builder.create(), onClosed);
        });
    }

    public void showPlaybackSettings() {
        activity.runOnUiThread(() -> {
            if (!hasPlayback()) return;
            String[] options = live ? new String[]{"Afspeelsnelheid", "Audio"} : new String[]{"Afspeelsnelheid", "Audio", "Ondertiteling"};
            AlertDialog dialog = dialogBuilder("Spelerinstellingen").setItems(options, (menu, index) -> {
                menu.dismiss();
                if (index == 0) showSpeedDialog();
                else if (index == 1) showAudioDialog(null);
                else showSubtitleDialog(null);
            }).create();
            showDialog(dialog, null);
        });
    }

    private void showSpeedDialog() {
        final float[] speeds = {0.25f, 0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f};
        String[] labels = activity.getResources().getStringArray(androidx.media3.ui.R.array.exo_controls_playback_speeds);
        int selected = 3;
        for (int index = 0; index < speeds.length; index++) if (Math.abs(player.getPlaybackParameters().speed - speeds[index]) < 0.01f) selected = index;
        AlertDialog dialog = dialogBuilder("Afspeelsnelheid").setSingleChoiceItems(labels, selected, (menu, index) -> {
            if (hasPlayback()) player.setPlaybackSpeed(speeds[index]);
            menu.dismiss();
        }).create();
        showDialog(dialog, null);
    }

    public String getActiveUrlHost() {
        try {
            Uri uri = Uri.parse(activeUrl);
            return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        } catch (Exception error) {
            return "";
        }
    }
}
