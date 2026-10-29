# Types commands into one window, as if on its keyboard: each stdin line, then Enter. Used to work in the terminal he lives in.
# Brings that window to the front first and checks before every line that it's still the one in front, so nothing
# ever lands in another window. Exit code 2: the window couldn't be brought to the front.
param([long]$Hwnd)
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Threading;
public static class Keys {
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort Vk, Scan; public uint Flags, Time; public IntPtr Extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int Dx, Dy; public uint Data, Flags, Time; public IntPtr Extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT M; [FieldOffset(0)] public KEYBDINPUT K; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint Type; public UNION U; }
  const uint KEYUP = 2, UNICODE = 4;
  static void Key(ushort vk, ushort scan, uint flags) {
    var i = new INPUT[2];
    i[0].Type = i[1].Type = 1;
    i[0].U.K = new KEYBDINPUT { Vk = vk, Scan = scan, Flags = flags };
    i[1].U.K = new KEYBDINPUT { Vk = vk, Scan = scan, Flags = flags | KEYUP };
    SendInput(2, i, Marshal.SizeOf(typeof(INPUT)));
  }
  public static bool Front(long hwnd) {
    var h = new IntPtr(hwnd);
    if (IsIconic(h)) ShowWindow(h, 9);
    Key(0x12, 0, 0); // a tap on Alt lets a background process take the foreground
    SetForegroundWindow(h);
    Thread.Sleep(150);
    return GetForegroundWindow() == h;
  }
  public static bool Line(long hwnd, string text) {
    if (GetForegroundWindow() != new IntPtr(hwnd)) return false;
    foreach (char c in text) { Key(0, c, UNICODE); Thread.Sleep(12); } // typed, not pasted: he's typing
    Key(0x0D, 0, 0); // Enter
    return true;
  }
}
'@
if (-not [Keys]::Front($Hwnd)) { exit 2 }
foreach ($line in [Console]::In.ReadToEnd() -split "`r?`n") {
  if (-not $line.Trim()) { continue }
  if (-not [Keys]::Line($Hwnd, $line)) { exit 2 }
  Start-Sleep -Milliseconds 400 # let the shell finish before the next one
}
