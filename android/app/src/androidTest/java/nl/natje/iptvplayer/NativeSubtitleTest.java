package nl.natje.iptvplayer;

import android.view.View;
import android.view.ViewGroup;
import android.widget.ListView;
import androidx.appcompat.app.AlertDialog;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.ui.PlayerView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.lang.reflect.Field;
import java.util.Collections;
import java.io.File;
import java.io.FileOutputStream;
import android.graphics.Bitmap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual Media3 decoding + captions + native mini/fullscreen menus; synthetic local MKV only. */
@UnstableApi
@RunWith(AndroidJUnit4.class)
public class NativeSubtitleTest {
    private PlayerView findPlayer(View view) {
        if (view instanceof PlayerView) return (PlayerView) view;
        if (view instanceof ViewGroup) for (int i=0;i<((ViewGroup)view).getChildCount();i++) {
            PlayerView found=findPlayer(((ViewGroup)view).getChildAt(i)); if(found!=null)return found;
        }
        return null;
    }
    private AlertDialog dialog() {
        try { Field field=TvPlayerManager.class.getDeclaredField("activeDialog");field.setAccessible(true);return (AlertDialog)field.get(TvPlayerManager.get()); }
        catch(Exception error){throw new AssertionError(error);}
    }
    private String labels(AlertDialog dialog) {
        StringBuilder labels=new StringBuilder();for(int i=0;i<dialog.getListView().getCount();i++)labels.append(dialog.getListView().getAdapter().getItem(i)).append("\n");return labels.toString();
    }
    private void click(AlertDialog dialog,int index) {
        ListView list=dialog.getListView();list.performItemClick(list.getChildAt(index-list.getFirstVisiblePosition()),index,list.getAdapter().getItemId(index));
    }
    private int index(AlertDialog dialog,String contains) {
        for(int i=0;i<dialog.getListView().getCount();i++)if(dialog.getListView().getAdapter().getItem(i).toString().contains(contains))return i;
        throw new AssertionError("Missing menu option: "+contains+" in "+labels(dialog));
    }
    private String selected(String key) {
        JSArray tracks=(JSArray)TvPlayerManager.get().currentTracks().opt(key);
        for(int i=0;i<tracks.length();i++)try{if(tracks.getJSONObject(i).optBoolean("selected"))return tracks.getJSONObject(i).optString("label");}catch(Exception error){throw new AssertionError(error);}
        return "";
    }
    private void await(ActivityScenario<MainActivity> scenario, java.util.function.BooleanSupplier condition) throws Exception {
        AtomicBoolean matched=new AtomicBoolean();
        for(int i=0;i<120;i++){scenario.onActivity(activity->matched.set(condition.getAsBoolean()));if(matched.get())return;Thread.sleep(100);}
        fail("Native subtitle/audio condition timed out");
    }
    private void play(String name,long request) {
        TvPlayerManager.get().setMiniBounds(20,30,380,214);
        TvPlayerManager.get().play("http://10.0.2.2:8788/"+name,false,0,"Natje-subtitle-fixture",Collections.emptyMap(),Collections.emptyList(),false,request);
    }
    private void capture(String name) throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        Thread.sleep(250); // Wait for the dialog window's first drawn frame, not just isShowing().
        Bitmap screenshot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("Native screenshot",screenshot);
        File file=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),name+".png");
        try(FileOutputStream output=new FileOutputStream(file)){screenshot.compress(Bitmap.CompressFormat.PNG,100,output);}
    }

    @Test public void automaticDutchCuesManualLanguageOffAudioAndSpeedUseTheSamePlayer() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<Player> original=new AtomicReference<>(); AtomicReference<Object> media=new AtomicReference<>();
            scenario.onActivity(activity->{play("subtitles.mkv",1001);original.set(findPlayer(activity.findViewById(android.R.id.content)).getPlayer());});
            await(scenario,()->selected("subtitleTracks").contains("Dutch Full"));
            await(scenario,()->original.get().getCurrentCues().cues.stream().anyMatch(cue->cue.text!=null&&cue.text.toString().contains("Nederlandse volledige")));
            capture("native-dutch-captions");
            scenario.onActivity(activity->{
                PlayerView view=findPlayer(activity.findViewById(android.R.id.content));original.set(view.getPlayer());media.set(view.getPlayer().getCurrentMediaItem());
                assertEquals("auto",TvPlayerManager.get().currentTracks().optString("subtitleMode"));
            });
            AtomicInteger resolved=new AtomicInteger();
            scenario.onActivity(activity->{
                AndroidTvBridgePlugin plugin=(AndroidTvBridgePlugin)activity.getBridge().getPlugin("AndroidTvBridge").getInstance();
                plugin.showSubtitles(new PluginCall(null,"AndroidTvBridge","subtitle-test","showSubtitles",new JSObject()) {
                    @Override public void resolve(JSObject value){resolved.incrementAndGet();}
                });
                assertTrue(dialog().isShowing()); assertEquals(0,dialog().getListView().getCheckedItemPosition());
                assertTrue(labels(dialog()).contains("Dutch Forced"));assertTrue(labels(dialog()).contains("Dutch Full"));
            });
            capture("native-subtitle-menu");
            scenario.onActivity(activity->click(dialog(),index(dialog(),"English")));
            await(scenario,()->selected("subtitleTracks").contains("English"));assertEquals(1,resolved.get());
            await(scenario,()->original.get().getCurrentCues().cues.stream().anyMatch(cue->cue.text!=null&&cue.text.toString().contains("English captions")));
            scenario.onActivity(activity->{
                TvPlayerManager manager=TvPlayerManager.get();manager.enterFullscreen();
                findPlayer(activity.findViewById(android.R.id.content)).findViewById(androidx.media3.ui.R.id.exo_settings).performClick();
                assertTrue(labels(dialog()).contains("Afspeelsnelheid"));assertTrue(labels(dialog()).contains("Audio"));
                click(dialog(),index(dialog(),"Ondertiteling"));click(dialog(),1);
            });
            await(scenario,()->selected("subtitleTracks").isEmpty());
            await(scenario,()->original.get().getCurrentCues().cues.isEmpty());
            scenario.onActivity(activity->{
                TvPlayerManager.get().exitFullscreen();assertEquals("off",TvPlayerManager.get().currentTracks().optString("subtitleMode"));
                TvPlayerManager.get().showSubtitleDialog(null);click(dialog(),0);
            });
            await(scenario,()->selected("subtitleTracks").contains("Dutch Full"));
            scenario.onActivity(activity->{TvPlayerManager.get().enterFullscreen();TvPlayerManager.get().showPlaybackSettings();});
            capture("native-fullscreen-settings");
            scenario.onActivity(activity->click(dialog(),1));
            capture("native-audio-menu");
            scenario.onActivity(activity->click(dialog(),index(dialog(),"Nederlands")));
            await(scenario,()->selected("audioTracks").contains("Nederlands"));
            scenario.onActivity(activity->{
                assertTrue(selected("subtitleTracks").contains("Dutch Full"));
                TvPlayerManager.get().showPlaybackSettings();click(dialog(),0);assertEquals(7,dialog().getListView().getCount());click(dialog(),5);
                assertEquals(1.5f,original.get().getPlaybackParameters().speed,0.01f);
                TvPlayerManager.get().exitFullscreen();
                PlayerView view=findPlayer(activity.findViewById(android.R.id.content));assertSame(original.get(),view.getPlayer());assertSame(media.get(),view.getPlayer().getCurrentMediaItem());
                TvPlayerManager.get().stopPlayback();
            });
        }
    }

    @Test public void noDutchDoesNotAutoEnableEnglishAndNewPlaybackResetsManualOff() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity->play("subtitles.mkv",2001));await(scenario,()->selected("subtitleTracks").contains("Dutch Full"));
            scenario.onActivity(activity->TvPlayerManager.get().disableSubtitles());await(scenario,()->selected("subtitleTracks").isEmpty());
            scenario.onActivity(activity->play("subtitles.mkv",2002));await(scenario,()->selected("subtitleTracks").contains("Dutch Full"));
            scenario.onActivity(activity->play("english-only.mkv",2003));
            await(scenario,()->"playing".equals(TvPlayerManager.get().currentState().optString("state")));
            scenario.onActivity(activity->{
                assertEquals("",selected("subtitleTracks"));assertEquals("auto",TvPlayerManager.get().currentTracks().optString("subtitleMode"));
                TvPlayerManager.get().showSubtitleDialog(null);click(dialog(),index(dialog(),"English"));
            });
            await(scenario,()->selected("subtitleTracks").contains("English"));
            scenario.onActivity(activity->TvPlayerManager.get().stopPlayback());
        }
    }
}
