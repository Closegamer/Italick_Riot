// Self-extracting Italic launcher. tools/bundle-italic.mjs appends the app as a ZIP and this stub extracts it once to
// %LOCALAPPDATA%\Italic\app-<build id>, then starts Italic.exe from there. The file layout of the built exe:
//   [this launcher][zip archive][int64 little-endian zip length]
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Italic")]
[assembly: AssemblyProduct("Italic")]
[assembly: AssemblyCompany("Closegamer")]
[assembly: AssemblyDescription("writtenBy('Closegamer', 2026) - closegamer@mail.ru")]
[assembly: AssemblyCopyright("closegamer@mail.ru")]
[assembly: AssemblyVersion("__VERSION__")]
[assembly: AssemblyFileVersion("__VERSION__")]

static class Program
{
    private const string BuildId = "__BUILD_ID__";

    [STAThread]
    private static void Main()
    {
        try
        {
            string self = Assembly.GetExecutingAssembly().Location;
            long total = new FileInfo(self).Length;
            long zipLength;
            using (FileStream fs = new FileStream(self, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (total < 16) throw new InvalidDataException("Italic is damaged: the app archive is missing.");
                fs.Seek(-8, SeekOrigin.End);
                byte[] tail = new byte[8];
                fs.Read(tail, 0, 8);
                zipLength = BitConverter.ToInt64(tail, 0);
            }
            long zipStart = total - 8 - zipLength;
            if (zipStart <= 0) throw new InvalidDataException("Italic is damaged: the app archive is missing.");

            string home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Italic");
            Directory.CreateDirectory(home);
            string target = Path.Combine(home, "app-" + BuildId);
            string exe = Path.Combine(target, "Italic.exe");

            if (!File.Exists(exe))
            {
                string tempZip = Path.Combine(Path.GetTempPath(), "italic-" + Guid.NewGuid().ToString("N") + ".zip");
                try
                {
                    using (FileStream src = new FileStream(self, FileMode.Open, FileAccess.Read, FileShare.Read))
                    using (FileStream dst = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                    {
                        src.Seek(zipStart, SeekOrigin.Begin);
                        byte[] buffer = new byte[1048576];
                        long left = zipLength;
                        while (left > 0)
                        {
                            int n = src.Read(buffer, 0, (int)Math.Min(buffer.Length, left));
                            if (n <= 0) break;
                            dst.Write(buffer, 0, n);
                            left -= n;
                        }
                    }
                    if (Directory.Exists(target)) Directory.Delete(target, true);
                    ZipFile.ExtractToDirectory(tempZip, target);
                }
                finally
                {
                    if (File.Exists(tempZip)) File.Delete(tempZip);
                }

                // older builds are no longer needed once this one is unpacked
                foreach (string dir in Directory.GetDirectories(home, "app-*"))
                    if (!string.Equals(dir, target, StringComparison.OrdinalIgnoreCase))
                        try { Directory.Delete(dir, true); } catch { }
            }

            ProcessStartInfo info = new ProcessStartInfo(exe);
            info.WorkingDirectory = target;
            info.UseShellExecute = true;
            Process.Start(info);
        }
        catch (Exception e)
        {
            MessageBox.Show(e.Message, "Italic", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
