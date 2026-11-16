package nl.natje.iptvplayer;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.util.UnstableApi;
import java.util.Locale;

/** Prefer full Dutch captions over accessibility/forced-only variants. */
@UnstableApi
final class SubtitlePolicy {
    private SubtitlePolicy() { }

    static boolean isDutch(String language, String label) {
        String code = language == null ? "" : language.toLowerCase(Locale.ROOT).replace('_', '-');
        String root = code.split("-", 2)[0];
        if (root.equals("nl") || root.equals("nld") || root.equals("dut")) return true;
        if (!root.isEmpty() && !root.equals("und")) return false;
        return label != null && label.toLowerCase(Locale.ROOT).matches(".*\\b(dutch|nederlands|nederlandse|nl|nld|dut)\\b.*");
    }

    static int score(Format format) {
        return score(format.language, format.label, format.selectionFlags, format.roleFlags);
    }

    static int score(String language, String name, int selectionFlags, int roleFlags) {
        if (!isDutch(language, name)) return -1;
        String label = name == null ? "" : name.toLowerCase(Locale.ROOT);
        int score = 100;
        if (label.contains("full") || label.contains("volledig")) score += 20;
        if ((selectionFlags & C.SELECTION_FLAG_DEFAULT) != 0) score += 2;
        if ((selectionFlags & C.SELECTION_FLAG_FORCED) != 0 || label.contains("forced") || label.contains("foreign only")) score -= 80;
        if ((roleFlags & C.ROLE_FLAG_DESCRIBES_MUSIC_AND_SOUND) != 0 || label.contains("sdh") || label.contains("hearing")) score -= 10;
        return score;
    }
}
