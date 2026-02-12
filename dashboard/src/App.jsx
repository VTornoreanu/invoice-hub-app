import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  Upload,
  RefreshCw,
  Paperclip,
  FileText,
  Download,
  Printer,
  X,
  FilePlus,
  Globe,
  Trash2,
  Check,
  CheckSquare,
  Square,
  MessageSquare,
  User,
  MoreVertical,
  Mail,
  LayoutDashboard,
  CreditCard,
  Users,
  LogOut,
  Banknote,
  PiggyBank
} from 'lucide-react';
import { translations } from './translations';

const PAGE_SIZE = 50;
const API_URL = '/api';

const RenderDescription = ({ text }) => {
  if (!text) return null;
  const tags = ['SVWZ+', 'ABWA+', 'EREF+', 'MREF+', 'CRED+', 'IBAN+', 'BIC+', 'KREF+'];
  let lines = [text];
  tags.forEach(tag => {
    lines = lines.flatMap(line => {
      if (typeof line !== 'string') return line;
      const parts = line.split(tag);
      if (parts.length <= 1) return line;
      return [parts[0], ...parts.slice(1).map(p => tag + p)];
    });
  });

  return (
    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
      {lines.filter(l => l && l.trim()).map((line, idx) => {
        const tag = tags.find(t => line.startsWith(t));
        if (tag) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
              <span style={{ fontWeight: 700, minWidth: '45px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{tag.replace('+', '')}</span>
              <span style={{ opacity: 0.9 }}>{line.replace(tag, '')}</span>
            </div>
          );
        }
        return <div key={idx} style={{ fontWeight: 600, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{line}</div>;
      })}
    </div>
  );
};

function App() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang');
    return ['de', 'en', 'ro'].includes(saved) ? saved : 'de';
  });
  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);
  
  const translationsDefault = translations['de'];
  const t = translations[lang] || translationsDefault;

  const [pdfPeriodStart, setPdfPeriodStart] = useState('');
  const [pdfPeriodEnd, setPdfPeriodEnd] = useState('');

  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [dbUsers, setDbUsers] = useState([]);



  const fetchUsers = async () => {
    try {
      const resp = await fetch(`${API_URL}/users`);
      const data = await resp.json();
      setDbUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleLogin = (email, password) => {
    const user = dbUsers.find(u => u.email === email && u.password === password);
    if (user) {
      setIsLoggedIn(true);
      setCurrentUser(user);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', JSON.stringify(user));
      fetchData();
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    setCurrentView('landing');
    setLoading(false);
  };

  const [currentView, setCurrentView] = useState('landing');
  const [pdfs, setPdfs] = useState([]);
  const [pdfSort, setPdfSort] = useState({ key: 'upload_date', direction: 'desc' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [transactionsData, setTransactionsData] = useState([]);
  const [manualTransactionsData, setManualTransactionsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterYear, setFilterYear] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterEntity, setFilterEntity] = useState('All');
  const [entitiesList, setEntitiesList] = useState([]);
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [filterType, setFilterType] = useState('Both'); 
  const [filterProcessed, setFilterProcessed] = useState('All'); // All, Processed, Not Processed
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [unsentCount, setUnsentCount] = useState(0);

  // Lifted states for ManualView
  const [calculatedEUR, setCalculatedEUR] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [transactionDate, setTransactionDate] = useState(null);

  // Lifted states for AdminView
  const [adminFormData, setAdminForm] = useState({ email: '', password: '', role: 'viewer', name: '', phone: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showRecipientSelect, setShowRecipientSelect] = useState(false);

  // States for LoginPage
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportType, setReportType] = useState('comments');
  const [targetTransactionId, setTargetTransactionId] = useState(null);
  const [rowMenuId, setRowMenuId] = useState(null);

  useEffect(() => {
    fetchUsers();
    if (isLoggedIn) {
      fetchData();
    }
  }, []);

  const sortedPdfs = useMemo(() => {
    return [...pdfs].sort((a, b) => {
      const valA = a[pdfSort.key] || '';
      const valB = b[pdfSort.key] || '';
      if (valA < valB) return pdfSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return pdfSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pdfs, pdfSort]);
  
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDocs, setTxDocs] = useState([]);
  const [txComments, setTxComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [modalTab, setModalTab] = useState('docs');

  // Tracking for comments
  const [lastLogin] = useState(() => {
    const saved = localStorage.getItem('lastLogin');
    const now = new Date().toISOString();
    if (!saved) {
      localStorage.setItem('lastLogin', now);
      return now;
    }
    return saved;
  });

  const [readComments, setReadComments] = useState(() => {
    const saved = localStorage.getItem('readComments');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('readComments', JSON.stringify(readComments));
  }, [readComments]);

  const markAsRead = (txId) => {
    setReadComments(prev => ({
      ...prev,
      [txId]: new Date().toISOString()
    }));
  };


  const availableEntities = useMemo(() => {
    return ['All', ...entitiesList.sort()];
  }, [entitiesList]);

  useEffect(() => {
    const handleClickOutside = () => {
      setRowMenuId(null);
      setShowReportMenu(false);
      // We don't close recipient select automatically as it's a "flow"
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchUnsentCount = async () => {
    try {
      const resp = await fetch(`${API_URL}/comments/unsent/count`);
      const data = await resp.json();
      setUnsentCount(data.count || 0);
    } catch (err) { console.error(err); }
  };

  const handleSendReport = async (emails, type, transactionId = null) => {
    if (!emails || emails.length === 0) return;
    setIsSendingEmail(true);
    setShowRecipientSelect(false);
    try {
      const resp = await fetch(`${API_URL}/send-report`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: emails.join(', '), 
          type: type,
          transactionId: transactionId
        })
      });
      const data = await resp.json();
      alert(data.message);
      setSelectedRecipients([]);
      setTargetTransactionId(null);
      fetchUnsentCount();
    } catch (err) {
      alert('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const fetchPdfs = async () => {
    try {
      const resp = await fetch(`${API_URL}/pdfs`);
      const data = await resp.json();
      setPdfs(data || []);
    } catch (err) { console.error(err); }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      // Get bank transactions
      const resp = await fetch(`${API_URL}/transactions?source=bank`);
      const data = await resp.json();
      setTransactionsData(data || []);

      const manualResp = await fetch(`${API_URL}/transactions?source=manual`);
      const manualData = await manualResp.json();
      setManualTransactionsData(manualData || []);
      
      const sugResp = await fetch(`${API_URL}/suggestions`);
      const sugData = await sugResp.json();
      setSuggestions(sugData || []);

      const entResp = await fetch(`${API_URL}/entities`);
      const entData = await entResp.json();
      setEntitiesList(entData || []);

      fetchUnsentCount();
      fetchPdfs();
      fetchUsers();
    } catch (err) {
      console.error('Failed to fetch', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (txId) => {
    try {
      const resp = await fetch(`${API_URL}/transactions/${txId}/documents`);
      const data = await resp.json();
      setTxDocs(data || []);
    } catch (err) {
      console.error('Failed to fetch docs', err);
    }
  };

  const fetchComments = async (txId) => {
    try {
      const resp = await fetch(`${API_URL}/transactions/${txId}/comments`);
      const data = await resp.json();
      setTxComments(data || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTx) {
      fetchDocs(selectedTx.id);
      fetchComments(selectedTx.id);
    }
  }, [selectedTx]);

  const toggleAccounting = async (txId, currentStatus) => {
    // Optimistically update the UI
    setTransactionsData(prev => prev.map(tx => 
      tx.id === txId ? { ...tx, is_accounted: !currentStatus } : tx
    ));
    
    try {
      await fetch(`${API_URL}/transactions/${txId}/accounted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: !currentStatus })
      });
    } catch (err) {
      // Revert on error
      setTransactionsData(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, is_accounted: currentStatus } : tx
      ));
      alert('Failed to update status');
    }
  };

  const accountAllFiltered = async () => {
    // Get all filtered transaction IDs that are not yet accounted
    const filteredTxs = filteredTransactions.filter(tx => !tx.is_accounted);
    
    if (filteredTxs.length === 0) {
      alert('Alle Transaktionen sind bereits kontiert / All transactions are already accounted');
      return;
    }

    if (!window.confirm(`${filteredTxs.length} Transaktionen als kontiert markieren? / Mark ${filteredTxs.length} transactions as accounted?`)) {
      return;
    }

    // Optimistically update all
    const txIds = filteredTxs.map(tx => tx.id);
    setTransactionsData(prev => prev.map(tx => 
      txIds.includes(tx.id) ? { ...tx, is_accounted: true } : tx
    ));

    try {
      // Send all requests in parallel
      await Promise.all(txIds.map(txId => 
        fetch(`${API_URL}/transactions/${txId}/accounted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: true })
        })
      ));
    } catch (err) {
      // Revert on error
      setTransactionsData(prev => prev.map(tx => 
        txIds.includes(tx.id) ? { ...tx, is_accounted: false } : tx
      ));
      alert('Failed to update all transactions');
    }
  };

  const toggleProcessed = async (txId, currentStatus) => {
    // Optimistically update the UI
    setTransactionsData(prev => prev.map(tx => 
      tx.id === txId ? { ...tx, is_processed: !currentStatus } : tx
    ));
    
    try {
      await fetch(`${API_URL}/transactions/${txId}/processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: !currentStatus })
      });
    } catch (err) {
      // Revert on error
      setTransactionsData(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, is_processed: currentStatus } : tx
      ));
      alert('Failed to update processed status');
    }
  };

  const handleSaveExplanation = async (txId, explanation) => {
    try {
      await fetch(`${API_URL}/transactions/${txId}/explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation })
      });
      // Refresh only the list, selectedTx is already updated locally
      const resp = await fetch(`${API_URL}/transactions`);
      const data = await resp.json();
      setTransactionsData(data || []);
    } catch (err) {
      console.error('Failed to save explanation', err);
    }
  };

  const handlePrivatEntnahme = async (txId) => {
    try {
      // Update explanation to "Privat Entnahme"
      await fetch(`${API_URL}/transactions/${txId}/explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation: 'Privat Entnahme' })
      });
      
      // Mark as processed
      await fetch(`${API_URL}/transactions/${txId}/processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: true })
      });
      
      // Optimistically update UI
      setTransactionsData(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, explanation: 'Privat Entnahme', is_processed: true } : tx
      ));
      
      // Refresh data from backend
      const resp = await fetch(`${API_URL}/transactions`);
      const data = await resp.json();
      setTransactionsData(data || []);
    } catch (err) {
      console.error('Failed to set Privat Entnahme', err);
      alert('Failed to update transaction');
    }
  };

  const handlePrivateinlage = async (txId) => {
    try {
      // Update explanation to "Privateinlage"
      await fetch(`${API_URL}/transactions/${txId}/explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation: 'Privateinlage' })
      });
      
      // Mark as processed
      await fetch(`${API_URL}/transactions/${txId}/processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: true })
      });
      
      // Optimistically update UI
      setTransactionsData(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, explanation: 'Privateinlage', is_processed: true } : tx
      ));
      
      // Refresh data from backend
      const resp = await fetch(`${API_URL}/transactions`);
      const data = await resp.json();
      setTransactionsData(data || []);
    } catch (err) {
      console.error('Failed to set Privateinlage', err);
      alert('Failed to update transaction');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTx) return;
    try {
      await fetch(`${API_URL}/transactions/${selectedTx.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userEmail: currentUser.email,
          userRole: currentUser.role,
          text: commentText
        })
      });
      setCommentText('');
      fetchComments(selectedTx.id);
      fetchUnsentCount();
    } catch (err) {
      alert('Failed to add comment');
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set(transactionsData.map(tx => tx.date.split('-')[0]));
    return ['All', ...Array.from(years).sort((a, b) => b - a)];
  }, [transactionsData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      fetchData();
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDocUpload = async (e, txId) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch(`${API_URL}/transactions/${txId}/documents`, { method: 'POST', body: formData });
      fetchDocs(txId);
      fetchData();
    } catch (err) {
      alert('Document upload failed');
    }
  };



  const handleDeleteManualTx = async (id) => {
    console.log('Delete clicked for ID:', id);
    if (!window.confirm('Delete this transaction?')) {
      console.log('Delete cancelled by user');
      return;
    }
    try {
      console.log('Sending DELETE request to:', `${API_URL}/transactions/manual/${id}`);
      const response = await fetch(`${API_URL}/transactions/manual/${id}`, { method: 'DELETE' });
      console.log('Delete response:', response.status, response.statusText);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
      
      await fetchData();
      console.log('Transaction deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed: ' + err.message);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactionsData)) return [];
    
    // Process search term into words
    const searchTerms = (searchTerm || '').trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    let result = transactionsData.filter(tx => {
      try {
        const desc = (tx.description || '').toLowerCase();
        const cp = (tx.counterparty || '').toLowerCase();
        const ent = (tx.entity || '').toLowerCase();
        
        // Match Search Term (All words must be present somewhere)
        const matchesSearch = searchTerms.every(term => 
          desc.includes(term) ||
          cp.includes(term) ||
          ent.includes(term)
        );
        
        if (!matchesSearch) return false;

        // Date Range
        const txDate = tx.date || '';
        if (dateRange.start && txDate < dateRange.start) return false;
        if (dateRange.end && txDate > dateRange.end) return false;

        // Year/Month
        const [year, month] = txDate.split('-');
        if (filterYear !== 'All' && year !== filterYear) return false;
        if (filterMonth !== 'All' && parseInt(month).toString() !== filterMonth) return false;

        // Entity/Counterparty (be more permissive)
        if (filterEntity !== 'All') {
          const selectedEntity = filterEntity.toLowerCase();
          if (ent !== selectedEntity && cp !== selectedEntity) return false;
        }

        // Type
        if (filterType !== 'Both') {
          if (filterType === 'In' && tx.amount <= 0) return false;
          if (filterType === 'Out' && tx.amount >= 0) return false;
        }

        // Processed Status
        if (filterProcessed !== 'All') {
          if (filterProcessed === 'Processed' && !tx.is_processed) return false;
          if (filterProcessed === 'Not Processed' && tx.is_processed) return false;
        }

        return true;
      } catch (e) { 
        console.error('Filter error', e, tx);
        return false; 
      }
    });
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB, lang);
        } else {
          comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [transactionsData, searchTerm, dateRange, filterYear, filterMonth, filterEntity, filterType, filterProcessed, sortConfig, lang]);

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm || !showSuggestions) return [];
    const searchLower = searchTerm.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(searchLower)).slice(0, 8);
  }, [searchTerm, suggestions, showSuggestions]);

  const entityDropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(event.target)) {
        setShowEntitySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredEntitySuggestions = useMemo(() => {
    if (!showEntitySuggestions) return [];
    const searchLower = (entitySearch || '').toLowerCase();
    const filtered = availableEntities.filter(e => 
      e.toLowerCase().includes(searchLower)
    );
    return filtered.slice(0, 15);
  }, [entitySearch, availableEntities, showEntitySuggestions]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const totalIn = filteredTransactions.filter(tx => tx.amount > 0).reduce((acc, tx) => acc + tx.amount, 0);
    const totalOut = Math.abs(filteredTransactions.filter(tx => tx.amount < 0).reduce((acc, tx) => acc + tx.amount, 0));
    const balance = totalIn - totalOut;
    return { totalIn, totalOut, balance };
  }, [filteredTransactions]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading && currentView === 'bank') return <div className="loading-screen"><RefreshCw className="spin" /> {t.processing}</div>;

const LoginPage = ({ handleLogin, t }) => {
  const onSubmit = (e) => {
    e.preventDefault();
    if (!handleLogin(loginEmail, loginPassword)) {
      setLoginError(true);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ marginBottom: '30px' }}>
          <h1 className="logo" style={{ fontSize: '2rem', marginBottom: '8px' }}>{t.title}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t.loginSubtitle}</p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="filter-group" style={{ textAlign: 'left' }}>
            <label>{t.userMail}</label>
            <input 
              type="email" 
              className="search-input" 
              value={loginEmail} 
              onChange={e => setLoginEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="filter-group" style={{ textAlign: 'left' }}>
            <label>{t.password}</label>
            <input 
              type="password" 
              className="search-input" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              required 
            />
          </div>
          {loginError && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{t.invalidCredentials}</div>}
          <button className="send-report-btn" style={{ width: '100%', padding: '12px' }}>{t.loginBtn}</button>
        </form>
      </div>
    </div>
  );
};

const PartnerBar = ({ t }) => (
  <div style={{ 
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '30px'
  }}>
    {/* SNT CARD */}
    <div className="glass-panel" style={{ 
      padding: '24px 32px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '24px', 
      borderLeft: '5px solid #ef4444',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70px', width: '130px', flexShrink: 0 }}>
        <img src="/snt-logo.png" alt="SNT Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.01em', marginBottom: '6px', fontFamily: 'Outfit, sans-serif' }}>SNT BILANZBUCHHALTER GMBH</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          <div style={{ whiteSpace: 'nowrap' }}>{t.sntAddress}</div>
          <div style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
            <a href={`mailto:${t.sntEmail}`} style={{ color: 'inherit', textDecoration: 'none' }}>{t.sntEmail}</a>
          </div>
          <div style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
            Tel: <a href={`tel:${t.sntPhone.replace(/\s+/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>{t.sntPhone}</a>
          </div>
        </div>
      </div>
    </div>

    {/* VIRGIL CARD */}
    <div className="glass-panel" style={{ 
      padding: '24px 32px', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      borderRight: '5px solid var(--accent-color)', 
      textAlign: 'right',
      position: 'relative'
    }}>
      <div style={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', fontFamily: 'Outfit, sans-serif', marginBottom: '6px' }}>Dipl.Kfm. Virgil Tornoreanu, BBA</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
        <div style={{ color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>MSc in Business Analysis & Data Science</div>
        <div style={{ opacity: 0.9, fontStyle: 'italic', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>Erzherzogin Isabelle Str. 7-9/5, 2500 Baden b. Wien</div>
        <div style={{ color: 'var(--accent-color)', fontWeight: 800 }}>
          Email: <a href="mailto:virgil@tornoreanu.ro" style={{ color: 'inherit', textDecoration: 'none' }}>virgil@tornoreanu.ro</a>
        </div>
        <div style={{ color: 'var(--accent-color)', fontWeight: 800 }}>
          Tel: <a href="tel:+40730232323" style={{ color: 'inherit', textDecoration: 'none' }}>+40 730 232323</a>
        </div>
      </div>
    </div>
  </div>
);

const LandingPage = ({ setCurrentView, t }) => (
  <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px' }}>
    <PartnerBar t={t} />
    
    <div style={{ textAlign: 'center', marginBottom: '60px' }}>
      <h1 style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: '16px', color: 'white' }}>{t.title}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto' }}>{t.subtitle}</p>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
      {/* Section 1: PDF */}
      <div className="glass-panel landing-card" style={{ padding: '40px', cursor: 'pointer' }} onClick={() => setCurrentView('pdf')}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <FileText size={32} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>{t.section1}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.section1Desc}</p>
      </div>

      {/* Section 2: Analysis */}
      <div className="glass-panel landing-card" style={{ padding: '40px', cursor: 'pointer', border: '1px solid var(--accent-color)' }} onClick={() => setCurrentView('bank')}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <LayoutDashboard size={32} color="var(--accent-color)" />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>{t.section2}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.section2Desc}</p>
      </div>

      {/* Section 3: Manual */}
      <div className="glass-panel landing-card" style={{ padding: '40px', cursor: 'pointer' }} onClick={() => setCurrentView('manual')}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <CreditCard size={32} color="#10b981" />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>{t.section3}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.section3Desc}</p>
      </div>
    </div>

    <footer style={{ marginTop: '80px', paddingTop: '40px', borderTop: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
      {t.copyright}
    </footer>
  </div>
);

const Header = ({ 
  currentView, 
  setCurrentView, 
  isLoggedIn, 
  currentUser, 
  lang, 
  setLang, 
  handleLogout, 
  unsentCount, 
  showReportMenu, 
  setShowReportMenu, 
  reportType, 
  setReportType, 
  showRecipientSelect, 
  setShowRecipientSelect, 
  selectedRecipients, 
  setSelectedRecipients, 
  isSendingEmail, 
  handleSendReport, 
  handleReset,
  uploading,
  handleFileUpload,
  t,
  dbUsers
}) => (
  <header className="header">
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <h1 className="logo" onClick={() => setCurrentView('landing')} style={{ cursor: 'pointer' }}>
        {currentView === 'landing' ? t.title : 
         currentView === 'bank' ? t.section2 : 
         currentView === 'pdf' ? t.section1 : 
         currentView === 'admin' ? t.adminPage : 
         t.section3}
      </h1>
      {isLoggedIn && currentView !== 'landing' && (
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
           <button className={`page-btn ${currentView === 'pdf' ? 'active' : ''}`} onClick={() => setCurrentView('pdf')} title={t.section1}><FileText size={18}/></button>
           <button className={`page-btn ${currentView === 'bank' ? 'active' : ''}`} onClick={() => setCurrentView('bank')} title={t.section2}><LayoutDashboard size={18}/></button>
           <button className={`page-btn ${currentView === 'manual' ? 'active' : ''}`} onClick={() => setCurrentView('manual')} title={t.section3}><CreditCard size={18}/></button>
           {currentUser.role === 'admin' && (
             <button className={`page-btn ${currentView === 'admin' ? 'active' : ''}`} onClick={() => setCurrentView('admin')} title={t.adminPage}><Users size={18} /></button>
           )}
        </nav>
      )}
    </div>
    
    <div className="header-actions">
      <div className="user-selector">
        <Globe size={18} color="var(--text-secondary)" />
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
          <option value="ro">Română</option>
        </select>
      </div>

      {isLoggedIn && (
        <>
          <div className="user-selector" style={{ background: 'rgba(255,255,255,0.05)', padding: '0 12px' }}>
            <User size={18} color="var(--accent-color)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {currentUser?.name ? 
                currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 
                currentUser?.email?.split('@')[0]?.substring(0, 2).toUpperCase()
              }
            </span>
          </div>

          <button className="page-btn" onClick={handleLogout} style={{ border: 'none', background: 'transparent' }} title={t.logoutBtn}><LogOut size={18} color="var(--error)" /></button>
        </>
      )}

      {isLoggedIn && (currentView === 'bank' || currentView === 'manual') && (
        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
          <button 
            className="page-btn" 
            style={{ 
              padding: '8px', 
              background: unsentCount > 0 ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'var(--glass-bg)',
              animation: unsentCount > 0 ? 'pulse 2s infinite' : 'none',
              color: 'white'
            }}
            onClick={(e) => { e.stopPropagation(); setShowReportMenu(!showReportMenu); }}
          >
            <MoreVertical size={20} />
          </button>
          
          {showReportMenu && (
            <div className="suggestions-dropdown" style={{ left: 'auto', right: 0, top: '100%', minWidth: '240px', marginTop: '8px', zIndex: 1000 }}>
              <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>
                {t.reportMenu} {unsentCount > 0 && `(${unsentCount} ${t.comments})`}
              </div>
              <div className="suggestion-item" onClick={() => { setReportType('comments'); setShowRecipientSelect(true); setShowReportMenu(false); }}>
                <MessageSquare size={14} style={{ marginRight: '8px' }} /> {t.sendCommentsOnly}
              </div>
              <div className="suggestion-item" onClick={() => { setReportType('docs'); setShowRecipientSelect(true); setShowReportMenu(false); }}>
                <Paperclip size={14} style={{ marginRight: '8px' }} /> {t.sendDocsOnly}
              </div>
              <div className="suggestion-item" onClick={() => { setReportType('both'); setShowRecipientSelect(true); setShowReportMenu(false); }}>
                <Mail size={14} style={{ marginRight: '8px' }} /> {t.sendBoth}
              </div>

            </div>
          )}

          {showRecipientSelect && (
            <div className="suggestions-dropdown" style={{ left: 'auto', right: 0, top: '100%', minWidth: '260px', marginTop: '8px', zIndex: 1001 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.selectRecipient}</span>
                <button onClick={() => { setShowRecipientSelect(false); }} style={{ background: 'none', padding: 4 }}><X size={14}/></button>
              </div>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {dbUsers.map(u => {
                    const isSelected = selectedRecipients.includes(u.email);
                    return (
                      <div 
                        key={u.email} 
                        className={`suggestion-item ${isSelected ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) setSelectedRecipients(prev => prev.filter(e => e !== u.email));
                          else setSelectedRecipients(prev => [...prev, u.email]);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '4px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check size={10} />}
                          </div>
                          <span>{u.name || u.email.split('@')[0]} ({t[`role${u.role.charAt(0).toUpperCase() + u.role.slice(1)}`]})</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div style={{ padding: '8px' }}>
                <button 
                  disabled={selectedRecipients.length === 0 || isSendingEmail}
                  className="send-report-btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => handleSendReport(selectedRecipients, reportType)}
                >
                  {isSendingEmail ? <RefreshCw size={14} className="spin" /> : <Mail size={14} />} {t.sendNow}
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {currentView === 'bank' && currentUser?.role === 'admin' && (
        <label className="upload-btn">
          {uploading ? <RefreshCw className="spin" size={18} /> : <Upload size={18} />}
          <span style={{ marginLeft: '0.5rem' }}>{t.uploadTxt}</span>
          <input type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  </header>
);

  const BankView = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t.totalBalance}</div>
          <div className="stat-value">{formatCurrency(stats.balance)}</div>
          <div style={{ marginTop: '0.5rem' }}><Wallet size={16} color="var(--accent-color)" /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.income}</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>+ {formatCurrency(stats.totalIn)}</div>
          <div style={{ marginTop: '0.5rem' }}><TrendingUp size={16} color="var(--success)" /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.expenses}</div>
          <div className="stat-value" style={{ color: 'var(--error)' }}>- {formatCurrency(stats.totalOut)}</div>
          <div style={{ marginTop: '0.5rem' }}><TrendingDown size={16} color="var(--error)" /></div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="filters-bar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div style={{ position: 'relative', flex: 2 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                className="search-input" 
                style={{ paddingLeft: '40px', width: '100%' }} 
                placeholder={t.searchPlaceholder} 
                value={searchTerm} 
                onFocus={() => setShowSuggestions(true)} 
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setShowSuggestions(true); }} 
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {filteredSuggestions.map((s, i) => (
                    <div key={i} className="suggestion-item" onClick={() => { setSearchTerm(s); setShowSuggestions(false); setCurrentPage(1); }}>{s}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
              <Calendar size={18} color="var(--text-secondary)" />
              <input type="date" className="search-input" value={dateRange.start} onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setCurrentPage(1); }} />
              <span style={{ color: 'var(--text-secondary)' }}>{t.dateTo}</span>
              <input type="date" className="search-input" value={dateRange.end} onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setCurrentPage(1); }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="filter-group">
              <label>{t.year}</label>
              <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}>
                {availableYears.map(y => <option key={y} value={y}>{y === 'All' ? t.all : y}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>{t.month}</label>
              <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}>
                <option value="All">{t.all}</option>
                {t.months.map((m, i) => <option key={m} value={(i + 1).toString()}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group" ref={entityDropdownRef} style={{ position: 'relative', minWidth: '180px' }}>
              <label>{t.entity}</label>
              <div 
                className={`search-input ${filterEntity !== 'All' ? 'active' : ''}`}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '0 12px',
                  height: '42px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px'
                }}
                onClick={() => {
                  setShowEntitySuggestions(!showEntitySuggestions);
                  if (!showEntitySuggestions) setEntitySearch('');
                }}
              >
                <span style={{ 
                  fontSize: '0.875rem', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  maxWidth: '140px'
                }}>
                  {filterEntity === 'All' ? t.all : filterEntity}
                </span>
                {filterEntity !== 'All' ? (
                  <X 
                    size={14} 
                    style={{ flexShrink: 0, color: 'var(--text-secondary)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterEntity('All');
                      setEntitySearch('');
                      setShowEntitySuggestions(false);
                    }}
                  />
                ) : (
                  <Filter size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
                )}
              </div>
              
              {showEntitySuggestions && (
                <div className="suggestions-dropdown" style={{ width: '120%', left: '0' }}>
                  <div style={{ padding: '10px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                      <input 
                        autoFocus
                        className="search-input"
                        style={{ width: '100%', height: '34px', fontSize: '0.8125rem', paddingLeft: '32px' }}
                        placeholder={t.searchPlaceholder}
                        value={entitySearch}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEntitySearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <div 
                      className={`suggestion-item ${filterEntity === 'All' ? 'active' : ''}`}
                      onClick={() => {
                        setFilterEntity('All');
                        setShowEntitySuggestions(false);
                        setCurrentPage(1);
                      }}
                    >
                      {t.all}
                    </div>
                    {filteredEntitySuggestions.filter(e => e !== 'All').map((e, i) => (
                      <div 
                        key={i} 
                        className={`suggestion-item ${filterEntity === e ? 'active' : ''}`}
                        onClick={() => {
                          setFilterEntity(e);
                          setShowEntitySuggestions(false);
                          setCurrentPage(1);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>{e}</span>
                          {filterEntity === e && <Check size={14} />}
                        </div>
                      </div>
                    ))}
                    {filteredEntitySuggestions.length === 0 && entitySearch && (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        No entities found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="filter-group">
              <label>{t.type}</label>
              <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}>
                <option value="Both">{t.both}</option>
                <option value="In">{t.in}</option>
                <option value="Out">{t.out}</option>
              </select>
            </div>
            {currentUser?.role === 'admin' && (
              <div className="filter-group">
                <label>{t.processedStatus}</label>
                <select value={filterProcessed} onChange={(e) => { setFilterProcessed(e.target.value); setCurrentPage(1); }}>
                  <option value="All">{t.all}</option>
                  <option value="Processed">{t.processed}</option>
                  <option value="Not Processed">{t.notProcessed}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {filteredTransactions.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="send-report-btn" 
              onClick={accountAllFiltered}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: 'var(--accent-color)',
                padding: '10px 20px'
              }}
            >
              <CheckSquare size={18} />
              Alle kontieren / Account All ({filteredTransactions.filter(tx => !tx.is_accounted).length})
            </button>
          </div>
        )}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => requestSort('date')}>{t.date}</th>
                <th onClick={() => requestSort('description')}>{t.description}</th>
                <th onClick={() => requestSort('amount')}>{t.amount}</th>
                <th>{t.type}</th>
                <th>{t.accounted}</th>
                {currentUser?.role === 'admin' && <th>{t.processed}</th>}
                <th>{t.docs}</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx, idx) => {
                const isUnread = tx.comment_count > 0 && (!readComments[tx.id] || tx.last_comment_at > readComments[tx.id]);
                const isNewSinceLogin = tx.comment_count > 0 && tx.last_comment_at > lastLogin;

                return (
                  <tr key={`${tx.id || idx}`} className="tx-row" onClick={() => { setSelectedTx(tx); markAsRead(tx.id); }}>
                    <td><span className="date-pill">{formatDate(tx.date)}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{tx.counterparty || 'N/A'}</div>
                      <RenderDescription text={tx.description} />
                      {tx.entity && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-color)', marginTop: '4px', fontWeight: 600 }}>
                          {tx.entity}
                        </div>
                      )}
                      {tx.explanation && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#a78bfa', 
                          marginTop: '4px', 
                          background: 'rgba(139, 92, 246, 0.05)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          borderLeft: '2px solid #a78bfa',
                          fontWeight: 500
                        }}>
                          {tx.explanation}
                        </div>
                      )}
                    </td>
                    <td className={tx.amount >= 0 ? 'amount-positive' : 'amount-negative'}>{formatCurrency(tx.amount)}</td>
                    <td>
                      <span className={`badge ${tx.amount >= 0 ? 'badge-in' : 'badge-out'}`}>
                        {tx.amount >= 0 ? <><ArrowDownLeft size={12} /> {t.in}</> : <><ArrowUpRight size={12} /> {t.out}</>}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`accounted-btn ${tx.is_accounted ? 'active' : ''}`} 
                        onClick={(e) => { e.stopPropagation(); toggleAccounting(tx.id, tx.is_accounted); }}
                      >
                        {tx.is_accounted ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    {currentUser?.role === 'admin' && (
                      <td>
                        <button 
                          className={`accounted-btn ${tx.is_processed ? 'active' : ''}`} 
                          onClick={(e) => { e.stopPropagation(); toggleProcessed(tx.id, tx.is_processed); }}
                          style={{ background: tx.is_processed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined }}
                        >
                          {tx.is_processed ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {tx.document_count > 0 && (
                          <div className="doc-count" title={t.docs}>
                            <Paperclip size={14} /> <span>{tx.document_count}</span>
                          </div>
                        )}
                        {tx.comment_count > 0 && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {/* Total - Gray */}
                            <span className="comment-tag tag-gray" title="Total Comments">
                              <MessageSquare size={10} /> {tx.comment_count}
                            </span>
                            
                            {/* Unread - Yellow */}
                            {isUnread && (
                              <span className="comment-tag tag-yellow" title="Unread Comments">
                                !
                              </span>
                            )}

                            {/* New Since Login - Violet */}
                            {isNewSinceLogin && (
                              <span className="comment-tag tag-violet" title="New since login">
                                NEW
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button 
                        className="icon-btn" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setRowMenuId(rowMenuId === tx.id ? null : tx.id); 
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {rowMenuId === tx.id && (
                        <div className="suggestions-dropdown" style={{ left: 'auto', right: 0, top: '100%', minWidth: '220px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                          {currentUser?.role === 'admin' && (
                            <>
                              {/* Show Privateinlage only for positive amounts (Eingang/In) */}
                              {tx.amount >= 0 && (
                                <div className="suggestion-item" onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handlePrivateinlage(tx.id);
                                  setRowMenuId(null);
                                }}
                                style={{ 
                                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                                  borderLeft: '3px solid #3b82f6'
                                }}>
                                  <PiggyBank size={14} style={{ marginRight: '8px', color: '#3b82f6' }} /> {t.privateinlage}
                                </div>
                              )}
                              
                              {/* Show Privat Entnahme only for negative amounts (Ausgang/Out) */}
                              {tx.amount < 0 && (
                                <div className="suggestion-item" onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handlePrivatEntnahme(tx.id);
                                  setRowMenuId(null);
                                }}
                                style={{ 
                                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                                  borderLeft: '3px solid #ef4444'
                                }}>
                                  <Banknote size={14} style={{ marginRight: '8px', color: '#ef4444' }} /> {t.privatEntnahme}
                                </div>
                              )}
                              
                              {/* Separator only if we showed a private transaction option */}
                              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
                            </>
                          )}
                          <div className="suggestion-item" onClick={(e) => { 
                            e.stopPropagation(); 
                            setReportType('comments'); 
                            setTargetTransactionId(tx.id);
                            setShowRecipientSelect(true); 
                            setRowMenuId(null);
                          }}>
                            <MessageSquare size={14} style={{ marginRight: '8px' }} /> {t.sendCommentsOnly}
                          </div>
                          <div className="suggestion-item" onClick={(e) => { 
                            e.stopPropagation(); 
                            setReportType('docs'); 
                            setTargetTransactionId(tx.id);
                            setShowRecipientSelect(true); 
                            setRowMenuId(null);
                          }}>
                            <Paperclip size={14} style={{ marginRight: '8px' }} /> {t.sendDocsOnly}
                          </div>
                          <div className="suggestion-item" onClick={(e) => { 
                            e.stopPropagation(); 
                            setReportType('both'); 
                            setTargetTransactionId(tx.id);
                            setShowRecipientSelect(true); 
                            setRowMenuId(null);
                          }}>
                            <Mail size={14} style={{ marginRight: '8px' }} /> {t.sendBoth}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft size={20} /></button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t.page} {currentPage} {t.of} {totalPages}</span>
            <button className="page-btn" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight size={20} /></button>
          </div>
        )}
      </div>
    </>
  );

  const PdfView = () => (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>{t.section1}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t.section1Desc}</p>
        </div>
      </div>


      {currentUser?.role === 'admin' && (
      <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', marginBottom: '32px', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1rem', opacity: 0.8 }}>{t.uploadNew}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '20px' }}>
          <div className="filter-group">
             <label>{t.start}</label>
             <input type="date" className="search-input" value={pdfPeriodStart} onChange={e => setPdfPeriodStart(e.target.value)} required />
          </div>
          <div className="filter-group">
             <label>{t.end}</label>
             <input type="date" className="search-input" value={pdfPeriodEnd} onChange={e => setPdfPeriodEnd(e.target.value)} required />
          </div>
        </div>
        <div 
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          onDrop={async (e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            const file = e.dataTransfer.files[0];
            if (!file || !file.name.endsWith('.pdf')) {
              alert('Vă rugăm să încărcați un fișier PDF');
              return;
            }
            if (!pdfPeriodStart || !pdfPeriodEnd) {
              alert('Vă rugăm să completați datele de început și sfârșit');
              return;
            }
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('periodStart', pdfPeriodStart);
            formData.append('periodEnd', pdfPeriodEnd);
            try {
              await fetch(`${API_URL}/pdfs`, { method: 'POST', body: formData });
              fetchPdfs();
              setPdfPeriodStart('');
              setPdfPeriodEnd('');
            } catch (err) {
              console.error(err);
              alert('Eroare la încărcare');
            } finally {
              setUploading(false);
            }
          }}
          style={{ 
            border: '2px dashed var(--glass-border)', 
            borderRadius: '12px', 
            padding: '40px', 
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={() => document.getElementById('pdf-file-input').click()}
        >
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw className="spin" size={32} color="var(--accent-color)" />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Se încarcă...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Upload size={32} color="var(--accent-color)" />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Trageți PDF-ul aici sau click pentru a selecta</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Acceptă doar fișiere .pdf</p>
            </div>
          )}
          <input 
            id="pdf-file-input"
            type="file" 
            accept=".pdf" 
            style={{ display: 'none' }} 
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (!pdfPeriodStart || !pdfPeriodEnd) {
                alert('Vă rugăm să completați datele de început și sfârșit');
                return;
              }
              setUploading(true);
              const formData = new FormData();
              formData.append('file', file);
              formData.append('periodStart', pdfPeriodStart);
              formData.append('periodEnd', pdfPeriodEnd);
              try {
                await fetch(`${API_URL}/pdfs`, { method: 'POST', body: formData });
                fetchPdfs();
                setPdfPeriodStart('');
                setPdfPeriodEnd('');
                e.target.value = '';
              } catch (err) {
                console.error(err);
                alert('Eroare la încărcare');
              } finally {
                setUploading(false);
              }
            }} 
          />
        </div>
      </div>
      )}

      <div className="table-container shadow-lg">
        <table className="transaction-table">
          <thead>
            <tr>
              <th onClick={() => setPdfSort({ key: 'original_name', direction: pdfSort.key === 'original_name' && pdfSort.direction === 'asc' ? 'desc' : 'asc' })}>
                {t.description} {pdfSort.key === 'original_name' && (pdfSort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => setPdfSort({ key: 'period_start', direction: pdfSort.key === 'period_start' && pdfSort.direction === 'asc' ? 'desc' : 'asc' })}>
                {t.period} {pdfSort.key === 'period_start' && (pdfSort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => setPdfSort({ key: 'upload_date', direction: pdfSort.key === 'upload_date' && pdfSort.direction === 'asc' ? 'desc' : 'asc' })}>
                {t.date} {pdfSort.key === 'upload_date' && (pdfSort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ textAlign: 'right' }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPdfs.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} style={{ color: 'var(--error)', opacity: 0.8 }} />
                    <span style={{ fontWeight: 600 }}>{p.original_name}</span>
                  </div>
                </td>
                <td>
                  {(p.period_start || p.period_end) ? (
                    <div className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)', whiteSpace: 'nowrap' }}>
                      <Calendar size={12} style={{ marginRight: '6px' }} />
                      {p.period_start ? formatDate(p.period_start) : '?'} - {p.period_end ? formatDate(p.period_end) : '?'}
                    </div>
                  ) : '-'}
                </td>
                <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>{formatDate(p.upload_date)}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="icon-btn" onClick={() => window.open(`${API_URL}/pdfs/view/${p.filename}`, '_blank')} title={t.viewPdf}><Search size={16}/></button>
                    <a href={`${API_URL}/pdfs/view/${p.filename}`} download={p.original_name} className="icon-btn" title={t.download}><Download size={16}/></a>
                    <button className="icon-btn" onClick={() => {
                      const win = window.open(`${API_URL}/pdfs/view/${p.filename}`, '_blank');
                      if (win) {
                        win.onload = () => { 
                          setTimeout(() => {
                            try { win.print(); } catch(e) { console.error('Print failed', e); }
                          }, 1000); 
                        };
                      }
                    }} title={t.print}><Printer size={16}/></button>
                    <button className="icon-btn" style={{ color: 'var(--error)' }} onClick={async () => {
                      if (window.confirm(t.reset + '?')) {
                        await fetch(`${API_URL}/pdfs/${p.id}`, { method: 'DELETE' });
                        fetchPdfs();
                      }
                    }}><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const ManualView = () => {
    const calculateEUR = async (date, currency, amount) => {
      if (!date || !currency || !amount || currency === 'EUR') {
        setCalculatedEUR(null);
        setExchangeRate(null);
        setTransactionDate(null);
        return;
      }

      setIsCalculating(true);
      setTransactionDate(date);
      try {
        const response = await fetch(`${API_URL}/exchange-rate/${date}/${currency}`);
        const data = await response.json();
        
        if (data.rate) {
          const eurAmount = amount * data.rate;
          setCalculatedEUR(eurAmount);
          setExchangeRate(data.rate);
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate:', err);
        setCalculatedEUR(null);
        setExchangeRate(null);
      } finally {
        setIsCalculating(false);
      }
    };

    return (
    <div>
      {currentUser?.role === 'admin' && (
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '20px' }}>{t.addManual}</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const form = e.target;
          const original_currency = form.currency.value;
          const original_amount = parseFloat(form.original_amount.value);
          
          const tx = {
            date: form.date.value,
            counterparty: form.partner.value,
            description: form.desc.value,
            original_currency,
            original_amount,
            amount: original_currency === 'EUR' ? original_amount : calculatedEUR,
            entity: '' // Empty entity for single-client setup
          };
          
          console.log('Sending transaction:', tx);
          console.log('calculatedEUR:', calculatedEUR);
          
          await fetch(`${API_URL}/transactions/manual`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx) 
          });
          form.reset();
          setCalculatedEUR(null);
          setExchangeRate(null);
          setTransactionDate(null);
          fetchData();
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="filter-group">
              <label>{t.date}</label>
              <input 
                name="date" 
                type="date" 
                className="search-input" 
                style={{ minWidth: 0 }} 
                required 
                onChange={(e) => {
                  const form = e.target.form;
                  calculateEUR(e.target.value, form.currency.value, parseFloat(form.original_amount.value));
                }}
              />
            </div>
            <div className="filter-group">
              <label>{t.partner}</label>
              <input name="partner" className="search-input" style={{ minWidth: 0 }} required />
            </div>
            <div className="filter-group">
              <label>{t.description}</label>
              <input name="desc" className="search-input" style={{ minWidth: 0 }} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="filter-group">
              <label>Währung / Currency</label>
              <select 
                name="currency" 
                className="search-input" 
                style={{ minWidth: 0 }} 
                defaultValue="EUR" 
                required
                onChange={(e) => {
                  const form = e.target.form;
                  calculateEUR(form.date.value, e.target.value, parseFloat(form.original_amount.value));
                }}
              >
                <option value="EUR">EUR - Euro</option>
                <option value="RON">RON - Lei</option>
                <option value="HUF">HUF - Forint</option>
                <option value="USD">USD - Dollar</option>
                <option value="GBP">GBP - Pound</option>
                <option value="CHF">CHF - Franc</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Betrag (Original)</label>
              <input 
                name="original_amount" 
                type="number" 
                step="0.01" 
                className="search-input" 
                style={{ minWidth: 0 }} 
                required 
                onChange={(e) => {
                  const form = e.target.form;
                  calculateEUR(form.date.value, form.currency.value, parseFloat(e.target.value));
                }}
              />
            </div>
            <div className="filter-group">
              <label style={{ opacity: 0 }}>.</label>
              <button className="send-report-btn" style={{ height: '42px', width: '100%' }}>{t.save}</button>
            </div>
          </div>
          {exchangeRate && calculatedEUR !== null && transactionDate && (
            <div style={{ marginTop: '1rem', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '4px' }}>
                ECB Kurs vom {new Date(transactionDate).toLocaleDateString('de-DE')}: 1 {document.querySelector('[name="currency"]')?.value} = {exchangeRate.toFixed(4)} EUR
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                Betrag in EUR: {calculatedEUR.toFixed(2)} €
              </div>
            </div>
          )}
        </form>
      </div>
      )}

      <div className="glass-panel">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.description}</th>
              <th>Original</th>
              <th>Betrag (EUR)</th>
              <th style={{ textAlign: 'center' }}>{t.docs}</th>
              <th style={{ textAlign: 'center' }}>Chat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {manualTransactionsData.map(tx => (
              <tr key={tx.id} onClick={() => setSelectedTx(tx)}>
                <td>{formatDate(tx.date)}</td>
                <td>
                   <div style={{ fontWeight: 700 }}>{tx.counterparty}</div>
                   <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{tx.description}</div>
                </td>
                <td>
                  {tx.original_currency && tx.original_amount ? (
                    <div style={{ fontWeight: 600 }}>
                      {new Intl.NumberFormat('de-DE', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }).format(tx.original_amount)} {tx.original_currency}
                    </div>
                  ) : '-'}
                </td>
                <td className={tx.amount > 0 ? 'amount-in' : tx.amount < 0 ? 'amount-out' : ''}>
                  {tx.amount !== null ? (
                    tx.original_currency && tx.original_currency !== 'EUR' ? (
                      <span 
                        title={`Berechnet mit ECB-Kurs vom ${formatDate(tx.date)}\n1 ${tx.original_currency} = ${(tx.amount / tx.original_amount).toFixed(4)} EUR`}
                        style={{ cursor: 'help', borderBottom: '1px dotted currentColor' }}
                      >
                        {formatCurrency(tx.amount)}
                      </span>
                    ) : (
                      formatCurrency(tx.amount)
                    )
                  ) : (
                    <span style={{ opacity: 0.5, fontStyle: 'italic' }}>zu berechnen</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {tx.document_count > 0 && (
                    <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)' }}>
                      <Paperclip size={12} style={{ marginRight: '4px' }} /> {tx.document_count}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {tx.comment_count > 0 && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                      <MessageSquare size={12} style={{ marginRight: '4px' }} /> {tx.comment_count}
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}><MessageSquare size={16}/></button>
                    {currentUser?.role === 'admin' && (
                      <button className="icon-btn" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); handleDeleteManualTx(tx.id); }}><Trash2 size={16}/></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  };

  const AdminView = () => {
    const handleSubmit = async (e) => {
      e.preventDefault();
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `${API_URL}/users/${editingUser.id}` : `${API_URL}/users`;
      
      console.log('Submitting:', { method, url, formData: adminFormData });
      
      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adminFormData)
        });
        
        const result = await response.json();
        console.log('Response:', result);
        
        if (!response.ok) {
          alert(`Error: ${result.error || 'Failed to save user'}`);
          return;
        }
        
        await fetchUsers();
        setShowUserForm(false);
        setEditingUser(null);
        setAdminForm({ email: '', password: '', role: 'viewer', name: '', phone: '' });
      } catch (err) {
        console.error('Submit error:', err);
        alert('Failed to save user: ' + err.message);
      }
    };

    return (
      <div className="glass-panel" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>{t.adminPage}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t.userList}</p>
          </div>
          <button className="send-report-btn" onClick={() => {
            setShowUserForm(!showUserForm);
            if (showUserForm) {
              setEditingUser(null);
              setAdminForm({ email: '', password: '', role: 'viewer', name: '', phone: '' });
            }
          }}>
            {showUserForm ? t.cancel : t.addUserBtn}
          </button>
        </div>

        {showUserForm && (
          <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', marginBottom: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="filter-group">
                  <label>{t.fullName}</label>
                  <input className="search-input" style={{ minWidth: 0 }} value={adminFormData.name} onChange={e => setAdminForm({...adminFormData, name: e.target.value})} required />
                </div>
                <div className="filter-group">
                  <label>{t.userMail}</label>
                  <input type="email" className="search-input" style={{ minWidth: 0 }} value={adminFormData.email} onChange={e => setAdminForm({...adminFormData, email: e.target.value})} required />
                </div>
                <div className="filter-group">
                  <label>{t.phoneNumber}</label>
                  <input className="search-input" style={{ minWidth: 0 }} value={adminFormData.phone} onChange={e => setAdminForm({...adminFormData, phone: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="filter-group">
                  <label>{t.password} {editingUser && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(leave empty to keep current)</span>}</label>
                  <input type="password" className="search-input" style={{ minWidth: 0 }} value={adminFormData.password} onChange={e => setAdminForm({...adminFormData, password: e.target.value})} required={!editingUser} />
                </div>
                <div className="filter-group">
                  <label>{t.role}</label>
                  <select className="search-input" style={{ minWidth: 0 }} value={adminFormData.role} onChange={e => setAdminForm({...adminFormData, role: e.target.value})}>
                    <option value="viewer">{t.roleViewer}</option>
                    <option value="accountant">{t.roleAccountant}</option>
                    <option value="admin">{t.roleAdmin}</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label style={{ opacity: 0 }}>.</label>
                  <button type="submit" className="upload-btn" style={{ width: '100%', height: '42px', justifyContent: 'center', margin: 0 }}>
                    {editingUser ? 'Update User' : t.addUser}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="table-container shadow-lg">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>{t.fullName}</th>
                <th>{t.userMail}</th>
                <th>{t.phoneNumber}</th>
                <th>{t.role}</th>
                <th style={{ textAlign: 'right' }}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {dbUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name || '-'}</td>
                  <td style={{ opacity: 0.8 }}>{u.email}</td>
                  <td style={{ opacity: 0.8 }}>{u.phone || '-'}</td>
                  <td>
                    <span className="badge" style={{ 
                      background: u.role === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: u.role === 'admin' ? '#a78bfa' : 'white'
                    }}>
                      {t[`role${u.role.charAt(0).toUpperCase() + u.role.slice(1)}`]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="icon-btn" onClick={() => {
                        setEditingUser(u);
                        setAdminForm({ email: u.email, password: '', role: u.role, name: u.name || '', phone: u.phone || '' });
                        setShowUserForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} title="Edit"><User size={16} /></button>
                      <button className="icon-btn" style={{ color: 'var(--error)' }} onClick={async () => {
                        if (window.confirm(t.reset + '?')) {
                          await fetch(`${API_URL}/users/${u.id}`, { method: 'DELETE' });
                          fetchUsers();
                        }
                      }} title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <Header 
        currentView={currentView}
        setCurrentView={setCurrentView}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        lang={lang}
        setLang={setLang}
        handleLogout={handleLogout}
        unsentCount={unsentCount}
        showReportMenu={showReportMenu}
        setShowReportMenu={setShowReportMenu}
        reportType={reportType}
        setReportType={setReportType}
        showRecipientSelect={showRecipientSelect}
        setShowRecipientSelect={setShowRecipientSelect}
        selectedRecipients={selectedRecipients}
        setSelectedRecipients={setSelectedRecipients}
        isSendingEmail={isSendingEmail}
        handleSendReport={handleSendReport}

        uploading={uploading}
        handleFileUpload={handleFileUpload}
        t={t}
        dbUsers={dbUsers}
      />
      <main>
        {!isLoggedIn ? (
          LoginPage({ handleLogin, t })
        ) : (
          <>
            {loading && currentView === 'bank' && <div className="loading-screen"><RefreshCw className="spin" /> {t.processing}</div>}
            {!loading && (
              <>
                {currentView === 'landing' && <LandingPage setCurrentView={setCurrentView} t={t} />}
                {currentView === 'bank' && BankView()}
                {currentView === 'pdf' && PdfView()}
                {currentView === 'manual' && ManualView()}
                {currentView === 'admin' && AdminView()}
              </>
            )}
          </>
        )}
      </main>

      {selectedTx && (
        <div className="modal-overlay" onClick={() => { setSelectedTx(null); setModalTab('docs'); }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTx.counterparty || 'Transaction'}</h3>
              <button className="close-btn" onClick={() => { setSelectedTx(null); setModalTab('docs'); }}><X size={20} /></button>
            </div>
            
            <div className="modal-tabs">
              <button className={`tab-btn ${modalTab === 'docs' ? 'active' : ''}`} onClick={() => setModalTab('docs')}><Paperclip size={16} /> {t.docs} ({txDocs.length})</button>
              <button className={`tab-btn ${modalTab === 'chat' ? 'active' : ''}`} onClick={() => setModalTab('chat')}><MessageSquare size={16} /> {t.comments} ({txComments.length})</button>
            </div>

            <div className="tab-content">
              {modalTab === 'docs' && (
                <>
                  <div className="selected-tx-info">
                    <span>{formatDate(selectedTx.date)}</span>
                    <span className={selectedTx.amount >= 0 ? 'amount-positive' : 'amount-negative'}>{formatCurrency(selectedTx.amount)}</span>
                  </div>
                  <div className="doc-list">
                    {txDocs.length === 0 ? <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>{t.noDocs}</p> : txDocs.map(doc => (
                      <div key={doc.id} className="doc-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={18} color="var(--accent-color)" /> <span style={{ fontSize: '0.875rem' }}>{doc.original_name}</span></div>
                        <div className="doc-actions">
                          <a href={`${API_URL.replace('/api', '')}/api/documents/${doc.filename}`} target="_blank" className="icon-btn"><FileText size={16} /></a>
                          <a href={`${API_URL.replace('/api', '')}/api/documents/${doc.filename}`} download={doc.original_name} className="icon-btn"><Download size={16} /></a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      {t.explanation}
                    </label>
                    <textarea 
                      className="search-input"
                      style={{ width: '100%', minHeight: '80px', padding: '12px', resize: 'vertical' }}
                      value={selectedTx.explanation || ''}
                      placeholder={currentUser.email === 'virgil@tornoreanu.ro' ? t.writeComment : 'No explanation provided'}
                      readOnly={currentUser.email !== 'virgil@tornoreanu.ro'}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setSelectedTx(prev => ({ ...prev, explanation: newText }));
                      }}
                      onBlur={() => {
                        if (currentUser.email === 'virgil@tornoreanu.ro') {
                          handleSaveExplanation(selectedTx.id, selectedTx.explanation);
                        }
                      }}
                    />
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <label className="upload-btn" style={{ width: '100%', justifyContent: 'center' }}>
                      <FilePlus size={18} style={{ marginRight: '8px' }} /> {t.addAttachment}
                      <input type="file" style={{ display: 'none' }} onChange={(e) => handleDocUpload(e, selectedTx.id)} />
                    </label>
                  </div>
                </>
              )}

              {modalTab === 'chat' && (
                <div className="chat-container">
                  <div className="chat-messages">
                    {txComments.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No comments yet.</p> : txComments.map(c => (
                      <div key={c.id} className={`chat-msg ${c.user_email === currentUser.email ? 'own' : ''}`}>
                        <div className="msg-header">
                          <span className="msg-user">{c.user_email.split('@')[0]}</span>
                          <span className="msg-role">({t[`role${c.user_role.charAt(0).toUpperCase() + c.user_role.slice(1)}`]})</span>
                          <span className="msg-date">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="msg-text">{c.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="chat-input-area">
                    <input className="search-input" style={{ flex: 1 }} placeholder={t.writeComment} value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddComment()} />
                    <button className="upload-btn" style={{ padding: '0.5rem 1rem' }} onClick={handleAddComment}>{t.send}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
