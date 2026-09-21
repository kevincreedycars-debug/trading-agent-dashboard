"""Package the dependency-free local extension; no network or marketplace upload."""
from pathlib import Path
import zipfile
import json

source = Path(__file__).resolve().parent
root = source.parent.parent
manifest = json.loads((source / 'package.json').read_text())
target = root / '.local' / 'agent-mailbox-bridge' / ('trading-agent-mailbox-' + manifest['version'] + '.vsix')
target.parent.mkdir(parents=True, exist_ok=True)
xml = '''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata><Identity Language="en-US" Id="trading-agent-mailbox" Version="0.1.0" Publisher="trading-local"/><DisplayName>Trading Agent Mailbox</DisplayName><Description xml:space="preserve">Local Cline mailbox wake bridge</Description><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.85.0"/></Properties></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>'''
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('extension.vsixmanifest', xml)
    z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>')
    for name in ['package.json','extension.js','core.js','README.md']:
        z.write(source / name, 'extension/' + name)
print(target)
