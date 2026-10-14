import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AgendaView from './components/AgendaView';
import PacientesView from './components/PacientesView';
import HorariosView from './components/HorariosView';
import SecretariaView from './components/SecretariaView';
import FormularioTurnos from './components/FormularioTurnos';
import ArancelesView from './components/ArancelesView';
import DashboardView from './components/DashboardView';

export default function App() {
  const [session, setSession] = useState(null);
  const [profesional, setProfesional] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('agenda');
  
  const [showPublicForm, setShowPublicForm] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Sistema de Notificaciones y Modal
  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) cargarPerfil(session.user.id);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarPerfil(session.user.id);
    });
  }, []);

  const cargarPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfiles')
      .select('rol, profesional_id, profesionales(*)')
      .eq('user_id', userId)
      .single();
    if (data) setProfesional(data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fakeEmail = `${username.toLowerCase().trim()}@consultoriocs.com`;
    const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
    if (error) {
      mostrarMensaje('Usuario o contraseña incorrectos.', 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfesional(null);
    setShowLoginForm(false);
    setUsername('');
    setPassword('');
  };

  const cambiarMiClave = async () => {
    if (newPwd.length < 6) {
      return mostrarMensaje('La contraseña debe tener al menos 6 caracteres.', 'error');
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      mostrarMensaje('Error al cambiar la contraseña.', 'error');
    } else {
      mostrarMensaje('¡Contraseña actualizada con éxito!');
      setShowPwdModal(false);
      setNewPwd('');
    }
  };

  const ToastNotification = () => {
    if (!toast.visible) return null;
    const bgClass = toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]';
    return (
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] ${bgClass} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
        {toast.text}
      </div>
    );
  };

  // ================= VISTA PÚBLICA =================
  if (showPublicForm) {
    return (
      <div className="relative">
        <ToastNotification />
        <div className="absolute top-4 right-4 z-50">
          <button onClick={() => setShowPublicForm(false)} className="text-violet-700 font-extrabold text-[0.9rem] bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-full border border-line shadow-sm hover:bg-white transition-colors">
            Volver al inicio
          </button>
        </div>
        <FormularioTurnos />
      </div>
    );
  }

  // ================= PANTALLA DE BIENVENIDA Y LOGIN =================
  if (!session) {
    return (
      <div className="relative min-h-screen flex flex-col">
        <ToastNotification />
        <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/Fondo.png')" }}>
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col p-4">
          <div className="flex justify-end pt-2">
            {!showLoginForm ? (
              <button onClick={() => setShowLoginForm(true)} className="px-5 py-2.5 bg-white/90 backdrop-blur-md text-violet-900 font-extrabold text-[0.95rem] rounded-full border border-line shadow-sm hover:bg-white transition-colors">
                Iniciar sesión
              </button>
            ) : (
              <button onClick={() => setShowLoginForm(false)} className="px-5 py-2.5 bg-white/90 backdrop-blur-md text-violet-900 font-extrabold text-[0.95rem] rounded-full border border-line shadow-sm hover:bg-white transition-colors">
                Volver
              </button>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center">
            {!showLoginForm ? (
              <div className="w-full max-w-[420px] bg-surface backdrop-blur-xl border border-white/50 rounded-[28px] p-8 shadow-[0_20px_40px_rgba(62,39,96,0.15)] text-center animate-fade-in">
                <div className="w-[110px] h-[110px] mx-auto mb-5 rounded-full overflow-hidden bg-white border-[3px] border-white shadow-lg">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-[2.2rem] font-extrabold text-violet-700 leading-tight mb-1">Bienvenidos</h1>
                <p className="text-[1.1rem] text-muted font-bold mb-8">Consultorios de Salud</p>
                <button onClick={() => setShowPublicForm(true)} className="w-full px-6 py-4 bg-gradient-to-b from-[#7FA457] to-[#4C7536] text-white font-extrabold text-[1.15rem] rounded-[20px] shadow-[0_10px_24px_rgba(76,117,54,0.3)] hover:-translate-y-1 transition-transform">
                  Pedir tu turno
                </button>
              </div>
            ) : (
              <div className="w-full max-w-[420px] bg-surface backdrop-blur-xl border border-white/50 rounded-[28px] p-8 shadow-[0_20px_40px_rgba(62,39,96,0.15)] text-center animate-fade-in">
                <div className="w-[90px] h-[90px] mx-auto mb-4 rounded-full overflow-hidden bg-white border-[3px] border-white shadow-md">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-6">Acceso Staff</h2>
                <form onSubmit={handleLogin} className="grid gap-4 text-left">
                  <div>
                    <label className="block font-bold mb-1 text-ink">Usuario</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: kinesiologa" className="w-full text-ink bg-white/90 border border-line rounded-[16px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" required />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-ink">Contraseña</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full text-ink bg-white/90 border border-line rounded-[16px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" required />
                  </div>
                  <button type="submit" className="w-full mt-3 text-white font-extrabold text-[1.05rem] py-3.5 rounded-[18px] bg-gradient-to-b from-violet-500 to-violet-700 shadow-md hover:-translate-y-1 transition-transform">
                    Ingresar
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= INTERFAZ PRINCIPAL (STAFF LOGUEADO) =================
  return (
    <div className="relative z-10 max-w-[640px] mx-auto p-4 pt-5 min-h-screen flex flex-col">
      <BackgroundBlobs /> {/* <-- Agregamos el fondo del formulario de pacientes aquí */}
      <ToastNotification />
      
      {/* Modal Cambio de Clave */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 bg-violet-900/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[24px] p-6 shadow-xl w-full max-w-[340px] animate-fade-in">
            <h3 className="font-extrabold text-violet-700 text-[1.2rem] mb-2">Cambiar mi contraseña</h3>
            <p className="text-muted text-[0.9rem] mb-4">Ingresa una nueva clave de al menos 6 caracteres.</p>
            <input type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nueva contraseña..." className="w-full bg-field border border-line rounded-xl p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="flex gap-2">
              <button onClick={() => setShowPwdModal(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-glass_sec_bg text-violet-900 border border-line">Cancelar</button>
              <button onClick={cambiarMiClave} className="flex-1 py-2.5 rounded-xl font-bold bg-violet-700 text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <header className="relative z-10 flex items-center gap-3.5 mb-4 bg-surface backdrop-blur-md border border-line rounded-[22px] p-3 shadow-sm">
        <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden bg-white border-2 border-white/80 shadow-md">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-violet-700 text-[1.15rem] leading-tight truncate">Consultorios de Salud</div>
          <div className="text-muted text-[0.95rem] truncate">
            Panel · {profesional?.rol === 'secretaria' ? 'Secretaría' : (profesional?.profesionales?.especialidad?.replace('_', ' ') || 'Cargando...')}
          </div>
        </div>
        <div className="flex gap-2">
          {profesional?.rol === 'profesional' && (
            <button onClick={() => setShowPwdModal(true)} className="shrink-0 px-3 py-2 bg-glass_sec_bg border border-line rounded-[14px] text-violet-900 font-bold text-[0.85rem] hover:-translate-y-0.5 transition-transform">Clave</button>
          )}
          <button onClick={handleLogout} className="shrink-0 px-3 py-2 bg-glass_sec_bg border border-line rounded-[14px] text-violet-900 font-bold text-[0.85rem] hover:-translate-y-0.5 transition-transform">Salir</button>
        </div>
      </header>

      <main className="relative z-10 flex-1 pb-6">
        {profesional?.rol === 'secretaria' ? (
          <SecretariaView />
        ) : (
          <>
            {activeTab === 'agenda' && <AgendaView profesional={profesional} />}
            {activeTab === 'pacientes' && <PacientesView profesional={profesional} />}
            {activeTab === 'horarios' && <HorariosView profesional={profesional} />}
            {activeTab === 'aranceles' && <ArancelesView profesional={profesional} />}
            {activeTab === 'reportes' && <DashboardView profesional={profesional} />}
          </>
        )}
      </main>

      {/* Menú de 5 botones para Doctoras */}
      {profesional?.rol === 'profesional' && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-center bg-surface backdrop-blur-lg border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="flex w-full max-w-[760px] p-2 gap-1.5 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('agenda')} className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-[14px] font-bold text-[0.8rem] transition-colors ${activeTab === 'agenda' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Agenda</button>
            <button onClick={() => setActiveTab('pacientes')} className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-[14px] font-bold text-[0.8rem] transition-colors ${activeTab === 'pacientes' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Pacientes</button>
            <button onClick={() => setActiveTab('horarios')} className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-[14px] font-bold text-[0.8rem] transition-colors ${activeTab === 'horarios' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Horarios</button>
            <button onClick={() => setActiveTab('aranceles')} className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-[14px] font-bold text-[0.8rem] transition-colors ${activeTab === 'aranceles' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Aranceles</button>
            <button onClick={() => setActiveTab('reportes')} className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-[14px] font-bold text-[0.8rem] transition-colors ${activeTab === 'reportes' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Reportes</button>
          </div>
        </nav>
      )}
    </div>
  );
}

// Manchas de fondo (Componente agregado)
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-80">
      <div className="absolute w-[300px] h-[300px] bg-lav-300/30 rounded-full -left-[90px] -top-[100px]"></div>
      <div className="absolute w-[380px] h-[380px] bg-violet-500/20 rounded-full -right-[140px] -bottom-[120px]"></div>
      <div className="absolute w-[340px] h-[340px] bg-leaf/28 rounded-tr-full rounded-bl-full -left-[110px] -bottom-[90px] -rotate-12"></div>
      <div className="absolute w-[220px] h-[220px] bg-leaf/28 rounded-tl-full rounded-br-full right-[8%] bottom-[60px] rotate-18"></div>
    </div>
  );
}