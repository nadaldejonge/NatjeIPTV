package nl.natje.iptvplayer;

/** JSONObject stores small JS integers as Integer, not Long. Accept all numeric wrappers. */
final class BridgeNumbers {
    static long asLong(Object value, long fallback) {
        if (!(value instanceof Number)) return fallback;
        double number = ((Number) value).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number)) return fallback;
        return ((Number) value).longValue();
    }
}
