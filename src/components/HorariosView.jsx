import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Definimos los días de la semana (1 = Lunes, 7 = Domingo)
const DIAS_SEMANA = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' },
  { id: 6, nombre: 'Sábado' },
  { id: 7, nombre: 'Domingo' }
];

export default function HorariosView({ profesional }) {
  // Estado inicial con todos los días apagados y un horario por defecto
  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map(d => ({ ...d, activo: false, desde: '08:30', hasta: '18:00' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    fetchHorarios();
  }, []);

  const fetchHorarios = async () => {
    setLoading(true);
    // Buscamos los horarios actuales de esta doctora en la base de datos
    const { data, error } = await supabase
      .from('horarios_atencion')
      .select('*')
      .eq('profesional_id', profesional.profesionales.id);

    if (data) {
      // Combinamos la base de datos con nuestra lista de 7 días
      const horariosCargados = DIAS_SEMANA.map(diaBase => {
        const guardado = data.find(d => d.dia_semana === diaBase.id);
        if (guardado) {
          return { 
            ...diaBase, 
            activo: true, 
            desde: guardado.hora_desde.slice(0, 5), // Cortamos los segundos (08:30:00 -> 08:30)
            hasta: guardado.hora_hasta.slice(0, 5) 
          };
        }
        return { ...diaBase, activo: false, desde: '08:30', hasta: '18:00' };
      });
      setHorarios(horariosCargados);
    }
    setLoading(false);
  };

  const handleCambio = (id, campo, valor) => {
    setHorarios(prev => prev.map(h => h.id === id ? { ...h, [campo]: valor } : h));
  };

  const guardarHorarios = async () => {
    setSaving(true);
    setMensaje(null);
    
    // 1. Borramos los horarios anteriores de esta doctora para evitar duplicados
    await supabase
      .from('horarios_atencion')
      .delete()
      .eq('profesional_id', profesional.profesionales.id);

    // 2. Filtramos solo los días que dejó marcados como "activos"
    const horariosAInsertar = horarios
      .filter(h => h.activo)
      .map(h => ({
        profesional_id: profesional.profesionales.id,
        dia_semana: h.id,
        hora_desde: h.desde,
        hora_hasta: h.hasta
      }));

    // 3. Insertamos la nueva configuración
    if (horariosAInsertar.length > 0) {
      const { error } = await supabase.from('horarios_atencion').insert(horariosAInsertar);
      if (error) {
        setMensaje({ tipo: 'error', texto: 'Error al guardar. Intentá de nuevo.' });
        setSaving(false);
        return;
      }
    }
    
    setMensaje({ tipo: 'exito', texto: '¡Tus horarios se actualizaron correctamente!' });
    setSaving(false);
    
    // Ocultar mensaje después de 3 segundos
    setTimeout(() => setMensaje(null), 3000);
  };

  if (loading) return <div className="p-6 font-bold text-violet-700">Cargando configuración...</div>;

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-[0_10px_30px_rgba(62,39,96,0.12)] animate-fade-in">
      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Mis horarios</h2>
      <p className="text-muted mb-5 text-[0.95rem]">
        Elegí qué días atendés y en qué franja horaria. Los turnos web se calcularán en base a esto.
      </p>

      {/* Lista de Días */}
      <div className="grid gap-3 mb-6">
        {horarios.map((dia) => (
          <div key={dia.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-[1.5px] rounded-[18px] transition-colors ${dia.activo ? 'border-violet-500 bg-field' : 'border-line bg-surface/50'}`}>
            
            {/* Checkbox y Nombre del día */}
            <label className="flex items-center gap-3 cursor-pointer sm:w-1/3">
              <input 
                type="checkbox" 
                checked={dia.activo} 
                onChange={(e) => handleCambio(dia.id, 'activo', e.target.checked)}
                className="w-5 h-5 accent-violet-700 cursor-pointer"
              />
              <span className={`font-extrabold text-[1.05rem] ${dia.activo ? 'text-ink' : 'text-muted'}`}>
                {dia.nombre}
              </span>
            </label>

            {/* Inputs de Horario (Solo se muestran si el día está activo) */}
            {dia.activo ? (
              <div className="flex items-center gap-2 flex-1 animate-fade-in">
                <input 
                  type="time" 
                  value={dia.desde}
                  onChange={(e) => handleCambio(dia.id, 'desde', e.target.value)}
                  className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-[0.95rem]"
                />
                <span className="text-muted font-bold text-[0.9rem]">a</span>
                <input 
                  type="time" 
                  value={dia.hasta}
                  onChange={(e) => handleCambio(dia.id, 'hasta', e.target.value)}
                  className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-[0.95rem]"
                />
              </div>
            ) : (
              <div className="flex-1 text-muted text-[0.9rem] font-semibold sm:text-right">
                No atiende
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mensaje de feedback */}
      {mensaje && (
        <div className={`p-3 mb-4 rounded-[14px] font-bold text-center ${mensaje.tipo === 'exito' ? 'bg-leaf/20 text-leaf-700' : 'bg-err/20 text-err'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Botón Guardar */}
      <button 
        onClick={guardarHorarios}
        disabled={saving}
        className="w-full text-white font-extrabold text-[1.05rem] py-3.5 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-700 shadow-[0_8px_20px_rgba(62,39,96,0.25)] hover:-translate-y-0.5 transition-transform disabled:opacity-70 disabled:transform-none flex justify-center items-center gap-2"
      >
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
}