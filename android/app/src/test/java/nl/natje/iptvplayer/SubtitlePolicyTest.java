package nl.natje.iptvplayer;

import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import org.junit.Test;
import static org.junit.Assert.*;

@UnstableApi
public class SubtitlePolicyTest {
    private int score(String language, String label, int flags) {
        return SubtitlePolicy.score(language, label, flags, 0);
    }
    @Test public void recognizesDutchAliasesRegionsAndUnlabelledLanguageWithDutchName() {
        for (String language : new String[]{"nl", "nld", "dut", "nl-NL", "nl_BE", "DUT"}) assertTrue(language, SubtitlePolicy.isDutch(language, ""));
        assertTrue(SubtitlePolicy.isDutch("und", "Dutch Full"));
        assertTrue(SubtitlePolicy.isDutch(null, "Nederlands"));
        assertFalse(SubtitlePolicy.isDutch("en", "Dutch"));
        assertFalse(SubtitlePolicy.isDutch(null, "English"));
    }
    @Test public void prefersFullDutchOverDefaultEnglishForcedAndSdh() {
        int full = score("dut", "Dutch Full", 0);
        assertTrue(full > score("nl", "Dutch Forced", C.SELECTION_FLAG_DEFAULT | C.SELECTION_FLAG_FORCED));
        assertTrue(full > score("nld", "Dutch SDH", 0));
        assertEquals(-1, score("eng", "English", C.SELECTION_FLAG_DEFAULT));
    }
}
