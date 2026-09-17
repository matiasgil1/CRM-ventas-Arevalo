import React, { useState } from 'react';
import { Campaign, User } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { formatPeriodMMYYYY } from '../utils/formatters';
import { analyzePhoneWhatsApp } from '../utils/phoneUtils';
import { findMatchingSeller } from '../utils/sellerUtils';
import { areLeadsDuplicate } from '../utils/deduplicationUtils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  FileUp, Plus, Download, CheckCircle, AlertCircle, 
  Table, Sparkles, FolderPlus, ArrowRight, FileSpreadsheet, FileText,
  MessageCircle, Phone, Check, UserCheck, RefreshCw, UserPlus
} from 'lucide-react';

interface ImportModuleProps {
  campaigns: Campaign[];
  currentUser: User;
  users: User[];
  onImportComplete: () => void;
}

interface ParsedRow {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  ultimoPeriodoPagado: string;
  vendedor: string;
  direccion?: string;
  fechaInicio?: string;
  estadoDeuda?: string;
  cobrador?: string;
  sucursal?: string;
}

export const ImportModule: React.FC<ImportModuleProps> = ({
  campaigns,
  currentUser,
  users,
  onImportComplete
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns.length > 0 ? campaigns[0].id : ''
  );
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampName, setNewCampName] = useState('');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [newCampScript, setNewCampScript] = useState('');

  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [rawFileText, setRawFileText] = useState('');
  const [activeInputTab, setActiveInputTab] = useState<'file' | 'paste'>('file');
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    const sampleData = [
      {
        Cliente: 'LESCANO FRANCISCO OMAR',
        'Nro. Documento': '20261946',
        'Telefono Movil': '471378',
        'Fecha Inicio': '1/6/2006',
        Direccion: 'B. MARTIN FIERRO - MZ.D- L. 18',
        'Estado Deuda': 'MORA 1',
        'Ultimo Pago': '1/7/2026',
        'Promotor/Vendedor': '122-PEREYRA VICTOR MARTIN',
        Cobrador: '88 - REINOSO GUSTAVO ADRIAN',
        Sucursal: 'SUCURSAL ALBERDI SS'
      },
      {
        Cliente: 'PIÑERO HECTOR HUGO',
        'Nro. Documento': '16526583',
        'Telefono Movil': '3815009872',
        'Fecha Inicio': '1/6/2006',
        Direccion: 'LUCAS CORDOBA 156',
        'Estado Deuda': 'MORA 1',
        'Ultimo Pago': '1/7/2026',
        'Promotor/Vendedor': '122-PEREYRA VICTOR MARTIN',
        Cobrador: '88 - REINOSO GUSTAVO ADRIAN',
        Sucursal: 'SUCURSAL ALBERDI SS'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Base_Clientes_Arevalo');
    XLSX.writeFile(workbook, 'Plantilla_Importacion_Arevalo.xlsx');
  };

  // Create Campaign Modal Submit
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim()) return;

    const newCamp = await crmStore.addCampaign(newCampName, newCampDesc, newCampScript);
    setSelectedCampaignId(newCamp.id);
    setShowNewCampaignModal(false);
    setNewCampName('');
    setNewCampDesc('');
    setNewCampScript('');
  };

  // Helper to parse 2D matrix from Excel or CSV with dynamic column header and value detection
  const parse2DArrayToParsedRows = (data2D: any[][]): ParsedRow[] => {
    if (!data2D || data2D.length === 0) return [];

    // Filter out completely empty rows
    const cleanData2D = data2D.filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));
    if (cleanData2D.length === 0) return [];

    let headerRowIndex = -1;
    let fullNameCol = -1;
    let nombreCol = -1;
    let apellidoCol = -1;
    let dniCol = -1;
    let telefonoCol = -1;
    let periodoCol = -1;
    let vendedorCol = -1;
    let direccionCol = -1;
    let fechaInicioCol = -1;
    let estadoDeudaCol = -1;
    let cobradorCol = -1;
    let sucursalCol = -1;

    const headerKeywordsMap = {
      fullName: ['nombreyapellido', 'nombreapellido', 'nombrecompleto', 'nombrey-apellido', 'nombresyapellidos', 'socio', 'cliente', 'titular', 'abonado', 'persona', 'afiliado', 'razonsocial'],
      nombre: ['nombre', 'firstname', 'first', 'primer'],
      apellido: ['apellido', 'lastname', 'last', 'surname'],
      dni: ['dni', 'documento', 'doc', 'cedula', 'cuit', 'cuil', 'nrodoc', 'numdoc', 'identificacion', 'nrodocumento'],
      telefono: ['telefono', 'celular', 'tel', 'phone', 'movil', 'whatsapp', 'wa', 'cel', 'contacto', 'nrotelefono', 'numtelefono'],
      periodo: ['ultimoperiodopagado', 'periodopagado', 'ultimopago', 'periodo', 'pago', 'pagado', 'cuota', 'fechapago', 'mes', 'fecpago', 'ultpago'],
      vendedor: ['vendedor', 'vendedores', 'ejecutivo', 'asesor', 'agente', 'operador', 'user', 'usuario', 'asignado', 'vendedornombre', 'promotor', 'comercial'],
      direccion: ['direccion', 'domicilio', 'calle', 'address'],
      fechaInicio: ['fechainicio', 'fecinicio', 'alta', 'fechaalta', 'inicio'],
      estadoDeuda: ['estadodeuda', 'estado', 'deuda', 'situacion'],
      cobrador: ['cobrador', 'recaudador', 'cobranza'],
      sucursal: ['sucursal', 'agencia', 'filial', 'oficina']
    };

    // Scan first 10 rows to detect the Header Row
    for (let r = 0; r < Math.min(10, cleanData2D.length); r++) {
      const row = cleanData2D[r];
      let score = 0;

      row.forEach((cell: any) => {
        const cleanCell = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanCell) return;

        if (headerKeywordsMap.fullName.some(k => cleanCell === k || cleanCell.includes(k)) ||
            headerKeywordsMap.nombre.some(k => cleanCell === k) ||
            headerKeywordsMap.apellido.some(k => cleanCell === k) ||
            headerKeywordsMap.telefono.some(k => cleanCell === k || cleanCell.includes(k)) ||
            headerKeywordsMap.periodo.some(k => cleanCell === k || cleanCell.includes(k)) ||
            headerKeywordsMap.vendedor.some(k => cleanCell === k || cleanCell.includes(k)) ||
            headerKeywordsMap.direccion.some(k => cleanCell === k || cleanCell.includes(k)) ||
            headerKeywordsMap.dni.some(k => cleanCell === k)) {
          score++;
        }
      });

      if (score >= 1) {
        headerRowIndex = r;
        break;
      }
    }

    // Map column indices by matching headers
    if (headerRowIndex >= 0) {
      const headerRow = cleanData2D[headerRowIndex];
      headerRow.forEach((cell: any, colIdx: number) => {
        const cleanHeader = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanHeader) return;

        // Extra fields check
        if (direccionCol === -1 && headerKeywordsMap.direccion.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          direccionCol = colIdx;
          return;
        }
        if (fechaInicioCol === -1 && headerKeywordsMap.fechaInicio.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          fechaInicioCol = colIdx;
          return;
        }
        if (estadoDeudaCol === -1 && headerKeywordsMap.estadoDeuda.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          estadoDeudaCol = colIdx;
          return;
        }
        if (cobradorCol === -1 && headerKeywordsMap.cobrador.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          cobradorCol = colIdx;
          return;
        }
        if (sucursalCol === -1 && headerKeywordsMap.sucursal.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          sucursalCol = colIdx;
          return;
        }

        // Vendedor check (check first to avoid overlap)
        if (vendedorCol === -1 && headerKeywordsMap.vendedor.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          vendedorCol = colIdx;
          return;
        }

        // Período Pagado check (strictly exclude carnet/socio/nro/vendedor/dni/nombre/telefono)
        if (periodoCol === -1 &&
            !['carnet', 'nrosocio', 'socio', 'vendedor', 'dni', 'nombre', 'telefono', 'celular'].some(ex => cleanHeader.includes(ex)) &&
            headerKeywordsMap.periodo.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          periodoCol = colIdx;
          return;
        }

        // Teléfono check
        if (telefonoCol === -1 && !cleanHeader.includes('vendedor') && headerKeywordsMap.telefono.some(k => cleanHeader === k || cleanHeader.includes(k))) {
          telefonoCol = colIdx;
          return;
        }

        // Full Name check
        if (fullNameCol === -1 && (headerKeywordsMap.fullName.some(k => cleanHeader === k || cleanHeader.includes(k)) || (cleanHeader.includes('nombre') && cleanHeader.includes('apellido')))) {
          fullNameCol = colIdx;
          return;
        }

        // Nombre check
        if (nombreCol === -1 && !cleanHeader.includes('vendedor') && headerKeywordsMap.nombre.some(k => cleanHeader === k || cleanHeader.startsWith(k))) {
          nombreCol = colIdx;
          return;
        }

        // Apellido check
        if (apellidoCol === -1 && headerKeywordsMap.apellido.some(k => cleanHeader === k || cleanHeader.startsWith(k))) {
          apellidoCol = colIdx;
          return;
        }

        // DNI check
        if (dniCol === -1 && !cleanHeader.includes('vendedor') && !cleanHeader.includes('nombre') && headerKeywordsMap.dni.some(k => cleanHeader === k || cleanHeader.startsWith(k))) {
          dniCol = colIdx;
          return;
        }
      });
    }

    const startDataRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const sampleRows = cleanData2D.slice(startDataRow, startDataRow + 10);

    // Heuristic fallbacks for unmapped columns by analyzing cell content
    if (sampleRows.length > 0) {
      const numCols = Math.max(...sampleRows.map(r => r.length));

      for (let c = 0; c < numCols; c++) {
        const colValues = sampleRows.map(r => String(r[c] || '').trim()).filter(Boolean);

        // Period column heuristics
        if (periodoCol === -1) {
          const isPeriodCol = colValues.some(v => 
            /^([0-9]{1,2})[\/\-]([0-9]{4})$/.test(v) ||
            /^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/.test(v) ||
            /^\d{4,5}$/.test(v)
          );
          if (isPeriodCol) {
            periodoCol = c;
            continue;
          }
        }

        // Phone column heuristics
        if (telefonoCol === -1) {
          const isPhoneCol = colValues.filter(v => v.replace(/\D/g, '').length >= 6 && v.replace(/\D/g, '').length <= 13).length >= Math.ceil(colValues.length * 0.4);
          if (isPhoneCol) {
            telefonoCol = c;
            continue;
          }
        }

        // Full Name column heuristics
        if (fullNameCol === -1 && nombreCol === -1) {
          const isNameCol = colValues.filter(v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\.\'-]+$/.test(v) && v.includes(' ')).length >= Math.ceil(colValues.length * 0.4);
          if (isNameCol) {
            fullNameCol = c;
            continue;
          }
        }
      }
    }

    // Direct Positional Fallback if headers were absent or unmapped for standard 4-column layout (Name, Phone, Period, Vendedor)
    if (fullNameCol === -1 && nombreCol === -1 && cleanData2D[0] && cleanData2D[0].length >= 3) {
      fullNameCol = 0;
      if (telefonoCol === -1) telefonoCol = 1;
      if (periodoCol === -1) periodoCol = 2;
      if (vendedorCol === -1 && cleanData2D[0].length >= 4) vendedorCol = 3;
    }

    const resultRows: ParsedRow[] = [];

    for (let r = startDataRow; r < cleanData2D.length; r++) {
      const row = cleanData2D[r];
      if (!row || row.length === 0) continue;

      let fullNameVal = fullNameCol >= 0 ? String(row[fullNameCol] !== undefined && row[fullNameCol] !== null ? row[fullNameCol] : '').trim() : '';
      let nombreVal = nombreCol >= 0 ? String(row[nombreCol] !== undefined && row[nombreCol] !== null ? row[nombreCol] : '').trim() : '';
      let apellidoVal = apellidoCol >= 0 ? String(row[apellidoCol] !== undefined && row[apellidoCol] !== null ? row[apellidoCol] : '').trim() : '';

      if (fullNameVal && !nombreVal) {
        const parts = fullNameVal.split(/\s+/);
        if (parts.length >= 2) {
          nombreVal = parts.slice(0, -1).join(' ');
          apellidoVal = parts[parts.length - 1];
        } else {
          nombreVal = fullNameVal;
          apellidoVal = '';
        }
      } else if (nombreVal && !apellidoVal && nombreVal.includes(' ')) {
        const parts = nombreVal.split(/\s+/);
        if (parts.length >= 2) {
          nombreVal = parts.slice(0, -1).join(' ');
          apellidoVal = parts[parts.length - 1];
        }
      }

      const rawDni = dniCol >= 0 ? String(row[dniCol] !== undefined && row[dniCol] !== null ? row[dniCol] : '').trim() : '';
      const cleanDni = (val: string): string => {
        if (!val || !/\d/.test(val)) return '';
        return val.replace(/[^0-9]/g, '').trim();
      };

      const rawPhone = telefonoCol >= 0 ? String(row[telefonoCol] !== undefined && row[telefonoCol] !== null ? row[telefonoCol] : '').trim() : '';
      const rawPeriod = periodoCol >= 0 ? row[periodoCol] : '';
      const rawVendedor = vendedorCol >= 0 ? String(row[vendedorCol] !== undefined && row[vendedorCol] !== null ? row[vendedorCol] : '').trim() : '';
      
      const rawDireccion = direccionCol >= 0 ? String(row[direccionCol] || '').trim() : '';
      const rawFechaInicio = fechaInicioCol >= 0 ? String(row[fechaInicioCol] || '').trim() : '';
      const rawEstadoDeuda = estadoDeudaCol >= 0 ? String(row[estadoDeudaCol] || '').trim() : '';
      const rawCobrador = cobradorCol >= 0 ? String(row[cobradorCol] || '').trim() : '';
      const rawSucursal = sucursalCol >= 0 ? String(row[sucursalCol] || '').trim() : '';

      // Skip row if name, phone, and period are all empty or non-data header text
      if (!nombreVal && !rawPhone && !rawDni) continue;

      resultRows.push({
        nombre: nombreVal,
        apellido: apellidoVal,
        dni: cleanDni(rawDni),
        telefono: rawPhone.replace(/\D/g, ''),
        ultimoPeriodoPagado: formatPeriodMMYYYY(rawPeriod),
        vendedor: rawVendedor,
        direccion: rawDireccion,
        fechaInicio: rawFechaInicio,
        estadoDeuda: rawEstadoDeuda,
        cobrador: rawCobrador,
        sucursal: rawSucursal
      });
    }

    return resultRows;
  };

  // File Change Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = parse2DArrayToParsedRows(results.data as any[][]);
          setParsedData(rows);
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) return;
        const wb = XLSX.read(buffer, { type: 'array', raw: false, cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data2D = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][];
        const rows = parse2DArrayToParsedRows(data2D);
        setParsedData(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Paste CSV handler
  const handleParsePastedText = () => {
    if (!rawFileText.trim()) return;
    Papa.parse(rawFileText, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rows = parse2DArrayToParsedRows(results.data as any[][]);
        setParsedData(rows);
      }
    });
  };

  // Confirm Import into Campaign
  const handleConfirmImport = async () => {
    if (parsedData.length === 0) {
      setImportStatus({ success: false, msg: 'No se han detectado datos válidos para importar.' });
      return;
    }

    if (!selectedCampaignId) {
      setImportStatus({ success: false, msg: 'Por favor, selecciona una Campaña de destino.' });
      return;
    }

    const res = await crmStore.importLeads(parsedData, selectedCampaignId);
    setImportStatus({
      success: true,
      msg: `¡Importación completada! Se procesaron ${res.count} clientes en la campaña "${res.campaignName}": ${res.newCount} nuevos leads creados y ${res.updatedCount} existentes actualizados sin duplicación.`
    });

    setParsedData([]);
    setRawFileText('');
    onImportComplete();
  };

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Module Title */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
            <FileUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
              Módulo de Importación y Campañas
            </h1>
            <p className="text-xs text-[#718096] font-medium">
              Sube bases de datos Excel/CSV y asígnalas a campañas específicas.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadSample}
          className="px-4 py-2.5 bg-[#F3F7F7] hover:bg-gray-200 text-[#2D3748] rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto border border-[#E2E8F0]"
        >
          <Download className="w-4 h-4 text-[#40C4C0]" />
          <span>Descargar Plantilla (.xlsx)</span>
        </button>
      </div>

      {/* Campaign Selector / Creator */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-[#718096] uppercase tracking-wider">
            1. Selecciona la Campaña de Destino
          </label>
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="text-xs font-bold text-[#40C4C0] hover:underline flex items-center gap-1"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Crear Nueva Campaña</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campaigns.map((camp) => {
            const isSelected = selectedCampaignId === camp.id;
            return (
              <div
                key={camp.id}
                onClick={() => setSelectedCampaignId(camp.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'border-[#40C4C0] bg-[#F0FDFD] shadow-2xs ring-1 ring-[#40C4C0]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#40C4C0]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#2D3748]">{camp.nombre}</h3>
                  {isSelected && (
                    <span className="text-[10px] font-bold bg-[#40C4C0] text-white px-2 py-0.5 rounded-full">
                      Seleccionada
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#718096] line-clamp-2">{camp.descripcion}</p>
                <p className="text-[10px] text-[#718096] italic truncate">
                  WhatsApp: "{camp.scriptTemplate.slice(0, 50)}..."
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Import Input Options (File or Paste) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <label className="block text-xs font-bold text-[#718096] uppercase tracking-wider">
            2. Cargar Archivo de Clientes
          </label>

          <div className="flex items-center gap-2 bg-[#F3F7F7] p-1 rounded-xl text-xs font-bold border border-[#E2E8F0]">
            <button
              onClick={() => setActiveInputTab('file')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeInputTab === 'file' ? 'bg-white text-[#2D3748] shadow-xs' : 'text-[#718096]'
              }`}
            >
              Archivos (Excel / CSV)
            </button>
            <button
              onClick={() => setActiveInputTab('paste')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeInputTab === 'paste' ? 'bg-white text-[#2D3748] shadow-xs' : 'text-[#718096]'
              }`}
            >
              Pegar Texto CSV
            </button>
          </div>
        </div>

        {importStatus && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
            importStatus.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}>
            {importStatus.success ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{importStatus.msg}</span>
          </div>
        )}

        {activeInputTab === 'file' ? (
          <div className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-8 text-center hover:border-[#40C4C0] transition-all bg-[#F3F7F7]/50">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-file-input"
            />
            <label htmlFor="excel-file-input" className="cursor-pointer space-y-3 block">
              <div className="w-12 h-12 bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 rounded-xl flex items-center justify-center mx-auto shadow-2xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#2D3748]">
                  Haz clic para seleccionar o arrastra tu archivo Excel / CSV
                </p>
                <p className="text-xs text-[#718096] mt-1">
                  Formatos soportados: .xlsx, .xls, .csv (Columnas: Nombre, Apellido, DNI, Teléfono, Último Período Pagado)
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={rawFileText}
              onChange={(e) => setRawFileText(e.target.value)}
              rows={4}
              placeholder="Pega aquí los datos separados por comas o tabulaciones..."
              className="w-full p-3.5 text-xs font-mono rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0]"
            />
            <button
              onClick={handleParsePastedText}
              className="px-4 py-2.5 bg-[#2D3748] hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Procesar Texto
            </button>
          </div>
        )}

        {/* Live Data Preview Table */}
        {parsedData.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#2D3748] uppercase tracking-wider flex items-center gap-2">
                <Table className="w-4 h-4 text-[#40C4C0]" />
                <span>Vista Previa de Importación ({parsedData.length} registros detectados)</span>
              </h3>

              <button
                onClick={handleConfirmImport}
                className="px-5 py-2.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center gap-2 active:scale-98"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar e Importar al Pool General</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-60">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200">#</th>
                    <th className="p-2.5 border-b border-slate-200">Nombre y Apellido</th>
                    <th className="p-2.5 border-b border-slate-200">DNI</th>
                    <th className="p-2.5 border-b border-slate-200">Teléfono</th>
                    <th className="p-2.5 border-b border-slate-200">Último Pago</th>
                    <th className="p-2.5 border-b border-slate-200">Vendedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {parsedData.slice(0, 15).map((row, idx) => {
                    const fullName = `${row.nombre || ''} ${row.apellido || ''}`.trim() || '—';
                    const phoneInfo = analyzePhoneWhatsApp(row.telefono);
                    const matchedSeller = findMatchingSeller(row.vendedor, users);

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 text-slate-900 font-bold">{fullName}</td>
                        <td className="p-2.5 font-mono text-slate-600">{row.dni || '—'}</td>
                        <td className="p-2.5 font-mono">
                          {phoneInfo.isValidWhatsApp ? (
                            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                              <span>{phoneInfo.displayFormatted}</span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md border border-emerald-300">
                                <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>WA Válido</span>
                              </span>
                            </div>
                          ) : phoneInfo.statusLabel === 'Fijo (Sin WA)' ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <span>{phoneInfo.displayFormatted}</span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md border border-amber-300">
                                <Phone className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>Fijo (Sin WA)</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sin número</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-cyan-800">{row.ultimoPeriodoPagado || '—'}</td>
                        <td className="p-2.5 font-medium">
                          {matchedSeller ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px]">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{matchedSeller.name}</span>
                            </span>
                          ) : row.vendedor ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-cyan-900 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200 text-[11px]" title="Vendedor asignado desde el archivo">
                              <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              <span>{row.vendedor}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pool (Sin asignar)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsedData.length > 15 && (
              <p className="text-[11px] text-slate-400 text-center italic">
                Mostrando los primeros 15 de {parsedData.length} registros...
              </p>
            )}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Crear Nueva Campaña
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Campaña</label>
                <input
                  type="text"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  placeholder="Ej: Recupero Septiembre"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={newCampDesc}
                  onChange={(e) => setNewCampDesc(e.target.value)}
                  placeholder="Breve detalle del objetivo..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plantilla de Mensaje WhatsApp (Usa &#123;nombre&#125;, &#123;apellido&#125;, &#123;ultimoPeriodoPagado&#125;)
                </label>
                <textarea
                  value={newCampScript}
                  onChange={(e) => setNewCampScript(e.target.value)}
                  rows={3}
                  placeholder="Hola {nombre} {apellido}, te contactamos de Arevalo Servicios Sociales..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampaignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2BB6B1] text-white font-bold rounded-xl text-xs"
                >
                  Guardar Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
