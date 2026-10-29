# Lists the visible top-level windows 4 times a second, topmost first, as one JSON line whenever the list changes:
# [[hwnd, left, top, right, bottom], ...] in physical screen pixels (the visible frame, without the invisible resize border).
param([int]$Skip = 0) # our own process id: his overlay is not a platform
Add-Type @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class Win {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int size);
  [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmCloaked(IntPtr h, int a, out int v, int size);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  public static string List(uint skip) {
    var o = new List<string>();
    EnumWindows((h, l) => {
      uint pid; int cloaked; RECT r;
      GetWindowThreadProcessId(h, out pid);
      if (pid == skip || !IsWindowVisible(h) || IsIconic(h) || GetWindowTextLength(h) == 0) return true;
      if (DwmCloaked(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true; // on another virtual desktop, or a hidden UWP window
      if (DwmGetWindowAttribute(h, 9, out r, 16) != 0 || r.R - r.L < 120 || r.B - r.T < 80) return true;
      o.Add("[" + h.ToInt64() + "," + r.L + "," + r.T + "," + r.R + "," + r.B + "]");
      return true;
    }, IntPtr.Zero);
    return "[" + string.Join(",", o) + "]";
  }
}
'@
[Win]::SetProcessDPIAware() | Out-Null
$last = ''
while ($true) {
  $now = [Win]::List([uint32]$Skip)
  if ($now -ne $last) { [Console]::Out.WriteLine($now); [Console]::Out.Flush(); $last = $now }
  Start-Sleep -Milliseconds 250
}
