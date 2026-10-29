# Keeps his overlay window in another window's layer: each stdin line "<overlay hwnd> <window hwnd>" puts the overlay
# directly above that window in the z-order, so whatever lies on top of the window covers him too. Runs until stdin closes.
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Z {
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  const uint PREV = 3, NOSIZE = 1, NOMOVE = 2, NOACTIVATE = 0x10, NOOWNERZORDER = 0x200;
  public static void Above(long me, long target) {
    IntPtr m = new IntPtr(me), prev = GetWindow(new IntPtr(target), PREV);
    if (prev == m) return; // already there
    // just below the window that's above the target; if that one is topmost (taskbar, his chat...), the top of the normal windows
    bool topmost = prev == IntPtr.Zero || (GetWindowLong(prev, -20) & 0x8) != 0;
    SetWindowPos(m, topmost ? new IntPtr(-2) : prev, 0, 0, 0, 0, NOSIZE | NOMOVE | NOACTIVATE | NOOWNERZORDER);
  }
}
'@
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $me, $target = $line -split ' '
  if ($target) { [Z]::Above([long]$me, [long]$target) }
}
