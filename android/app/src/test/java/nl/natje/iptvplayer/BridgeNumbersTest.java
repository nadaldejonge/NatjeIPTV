package nl.natje.iptvplayer;

import org.junit.Test;
import static org.junit.Assert.*;

public class BridgeNumbersTest {
    @Test public void smallJsonRequestIdsAreNotSilentlyZero() {
        assertEquals(1L, BridgeNumbers.asLong(Integer.valueOf(1), 0L));
        assertEquals(125L, BridgeNumbers.asLong(Integer.valueOf(125), 0L));
        assertEquals(12L, BridgeNumbers.asLong(Long.valueOf(12L), 0L));
    }
    @Test public void numericPositionsAndMissingValuesRemainCompatible() {
        assertEquals(15000L, BridgeNumbers.asLong(Integer.valueOf(15000), 0L));
        assertEquals(3000000000L, BridgeNumbers.asLong(Long.valueOf(3000000000L), 0L));
        assertEquals(12L, BridgeNumbers.asLong(Double.valueOf(12), 0L));
        assertEquals(0L, BridgeNumbers.asLong(null, 0L));
        assertEquals(0L, BridgeNumbers.asLong("invalid", 0L));
        assertEquals(0L, BridgeNumbers.asLong(Double.NaN, 0L));
    }
}
