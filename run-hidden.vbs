' eBook Studio - 창 없이 서버를 켭니다. 자동 시작 등록에서 사용합니다.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = here
' 0 = 창을 띄우지 않음, False = 끝날 때까지 기다리지 않음
shell.Run "cmd /c node server\index.js", 0, False
