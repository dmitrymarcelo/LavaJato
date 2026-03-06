import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Edit3,
  X,
  Save,
  MinusCircle,
  PlusCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Screen, Product, ProductMovement } from '../types';
import { generateId, getTodayDate } from '../utils/app';

const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Shampoo Automotivo Neutro',
    category: 'Limpeza Externa',
    quantity: 15,
    minQuantity: 5,
    unit: 'Litros',
    price: 45.9,
    lastRestock: '2024-02-28',
    status: 'ok',
    image: 'https://images.unsplash.com/photo-1600456548090-7d1b3f0bbea5?q=80&w=200&auto=format&fit=crop',
    manualEntries: [],
    manualOutputs: [],
  },
  {
    id: '2',
    name: 'Cera de Carnauba Premium',
    category: 'Acabamento',
    quantity: 2,
    minQuantity: 4,
    unit: 'Unidades',
    price: 89.9,
    lastRestock: '2024-01-15',
    status: 'critical',
    image: 'https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?q=80&w=200&auto=format&fit=crop',
    manualEntries: [],
    manualOutputs: [],
  },
  {
    id: '3',
    name: 'Pretinho para Pneus',
    category: 'Acabamento',
    quantity: 8,
    minQuantity: 10,
    unit: 'Litros',
    price: 32.5,
    lastRestock: '2024-02-10',
    status: 'low',
    image: 'https://images.unsplash.com/photo-1625043484555-47841a752840?q=80&w=200&auto=format&fit=crop',
    manualEntries: [],
    manualOutputs: [],
  },
  {
    id: '4',
    name: 'Pano de Microfibra',
    category: 'Acessorios',
    quantity: 50,
    minQuantity: 20,
    unit: 'Unidades',
    price: 12,
    lastRestock: '2024-02-25',
    status: 'ok',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=200&auto=format&fit=crop',
    manualEntries: [],
    manualOutputs: [],
  },
  {
    id: '5',
    name: 'Desengraxante Multiuso',
    category: 'Limpeza Pesada',
    quantity: 25,
    minQuantity: 10,
    unit: 'Litros',
    price: 55,
    lastRestock: '2024-02-20',
    status: 'ok',
    image: 'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?q=80&w=200&auto=format&fit=crop',
    manualEntries: [],
    manualOutputs: [],
  },
];

type InventoryMovementEntry = ProductMovement & {
  kind: 'entry' | 'output';
  productId: string;
  productName: string;
  unit: string;
  currentQuantity: number;
};

const getProductStatus = (quantity: number, minQuantity: number): Product['status'] => {
  if (quantity <= minQuantity / 2) return 'critical';
  if (quantity <= minQuantity) return 'low';
  return 'ok';
};

const getTodayMovementQuantity = (movements: ProductMovement[] = []) =>
  movements
    .filter((movement) => movement.createdAt.slice(0, 10) === getTodayDate())
    .reduce((total, movement) => total + movement.quantity, 0);

const getLastMovement = (movements: ProductMovement[] = []) =>
  [...movements].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;

const getTodayEntryQuantity = (product: Product) => getTodayMovementQuantity(product.manualEntries || []);
const getTodayOutputQuantity = (product: Product) => getTodayMovementQuantity(product.manualOutputs || []);
const getLastEntry = (product: Product) => getLastMovement(product.manualEntries || []);
const getLastOutput = (product: Product) => getLastMovement(product.manualOutputs || []);

export default function Inventory({
  onNavigate,
  products = [],
  onUpdateProducts,
}: {
  onNavigate: (screen: Screen) => void;
  products?: Product[];
  onUpdateProducts?: (products: Product[]) => Promise<void> | void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [manualEntryProduct, setManualEntryProduct] = useState<Product | null>(null);
  const [manualOutputProduct, setManualOutputProduct] = useState<Product | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'low' | 'critical'>('all');
  const [productImage, setProductImage] = useState('');
  const [manualEntryQuantity, setManualEntryQuantity] = useState('');
  const [manualEntryNote, setManualEntryNote] = useState('Reposicao manual');
  const [manualOutputQuantity, setManualOutputQuantity] = useState('');
  const [manualOutputNote, setManualOutputNote] = useState('Consumo diario');

  useEffect(() => {
    setProductImage(editingProduct?.image || '');
  }, [editingProduct, isAdding]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || product.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const todayEntryCount = products.reduce(
    (total, product) => total + (product.manualEntries || []).filter((entry) => entry.createdAt.slice(0, 10) === getTodayDate()).length,
    0
  );
  const todayOutputCount = products.reduce(
    (total, product) => total + (product.manualOutputs || []).filter((output) => output.createdAt.slice(0, 10) === getTodayDate()).length,
    0
  );
  const productsRestockedToday = products.filter((product) => getTodayEntryQuantity(product) > 0).length;
  const productsUsedToday = products.filter((product) => getTodayOutputQuantity(product) > 0).length;
  const movementEntries: InventoryMovementEntry[] = products
    .flatMap((product) => [
      ...(product.manualEntries || []).map((entry) => ({
        ...entry,
        kind: 'entry' as const,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        currentQuantity: product.quantity,
      })),
      ...(product.manualOutputs || []).map((output) => ({
        ...output,
        kind: 'output' as const,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        currentQuantity: product.quantity,
      })),
    ])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const movementEntriesToday = movementEntries.filter((movement) => movement.createdAt.slice(0, 10) === getTodayDate());
  const entryQuantityToday = movementEntriesToday
    .filter((movement) => movement.kind === 'entry')
    .reduce((total, movement) => total + movement.quantity, 0);
  const outputQuantityToday = movementEntriesToday
    .filter((movement) => movement.kind === 'output')
    .reduce((total, movement) => total + movement.quantity, 0);

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este produto?')) {
      await onUpdateProducts?.(products.filter((product) => product.id !== id));
      setOpenMenuId(null);
    }
  };

  const openManualEntry = (product: Product) => {
    setManualEntryProduct(product);
    setManualEntryQuantity('');
    setManualEntryNote('Reposicao manual');
    setOpenMenuId(null);
  };

  const openManualOutput = (product: Product) => {
    setManualOutputProduct(product);
    setManualOutputQuantity('');
    setManualOutputNote('Consumo diario');
    setOpenMenuId(null);
  };

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const quantity = Number(formData.get('quantity'));
    const minQuantity = Number(formData.get('minQuantity'));

    const productData: Product = {
      id: editingProduct ? editingProduct.id : generateId(),
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      quantity,
      minQuantity,
      unit: formData.get('unit') as string,
      price: Number(formData.get('price')),
      lastRestock: editingProduct?.lastRestock || new Date().toISOString().split('T')[0],
      status: getProductStatus(quantity, minQuantity),
      image:
        productImage ||
        editingProduct?.image ||
        `https://images.unsplash.com/photo-1600456548090-7d1b3f0bbea5?q=80&w=200&auto=format&fit=crop&seed=${Math.random()}`,
      manualEntries: editingProduct?.manualEntries || [],
      manualOutputs: editingProduct?.manualOutputs || [],
    };

    if (editingProduct) {
      await onUpdateProducts?.(products.map((product) => (product.id === editingProduct.id ? productData : product)));
    } else {
      await onUpdateProducts?.([...products, productData]);
    }

    setIsAdding(false);
    setEditingProduct(null);
    setProductImage('');
  };

  const handleManualEntry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!manualEntryProduct) return;

    const quantity = Number(manualEntryQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert('Informe uma quantidade inteira maior que zero.');
      return;
    }

    const manualEntry: ProductMovement = {
      id: generateId(),
      quantity,
      note: manualEntryNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextProducts = products.map((product) => {
      if (product.id !== manualEntryProduct.id) {
        return product;
      }

      const nextQuantity = product.quantity + quantity;
      return {
        ...product,
        quantity: nextQuantity,
        lastRestock: getTodayDate(),
        status: getProductStatus(nextQuantity, product.minQuantity),
        manualEntries: [manualEntry, ...(product.manualEntries || [])],
      };
    });

    await onUpdateProducts?.(nextProducts);
    setManualEntryProduct(null);
    setManualEntryQuantity('');
    setManualEntryNote('Reposicao manual');
  };

  const handleManualOutput = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!manualOutputProduct) return;

    const quantity = Number(manualOutputQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert('Informe uma quantidade inteira maior que zero.');
      return;
    }

    if (quantity > manualOutputProduct.quantity) {
      alert('A baixa manual nao pode ser maior que o estoque atual.');
      return;
    }

    const manualOutput: ProductMovement = {
      id: generateId(),
      quantity,
      note: manualOutputNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextProducts = products.map((product) => {
      if (product.id !== manualOutputProduct.id) {
        return product;
      }

      const nextQuantity = product.quantity - quantity;
      return {
        ...product,
        quantity: nextQuantity,
        status: getProductStatus(nextQuantity, product.minQuantity),
        manualOutputs: [manualOutput, ...(product.manualOutputs || [])],
      };
    });

    await onUpdateProducts?.(nextProducts);
    setManualOutputProduct(null);
    setManualOutputQuantity('');
    setManualOutputNote('Consumo diario');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProductImage(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const getStatusColor = (status: Product['status']) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'low':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'critical':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getStatusLabel = (status: Product['status']) => {
    switch (status) {
      case 'ok':
        return 'Estoque Normal';
      case 'low':
        return 'Estoque Baixo';
      case 'critical':
        return 'Critico';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      <div className="px-6 pt-6 pb-2 flex justify-end items-center">
        <button
          onClick={() => {
            setEditingProduct(null);
            setIsAdding(true);
          }}
          className="bg-primary text-white p-3 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-transform flex items-center gap-2"
        >
          <Plus className="w-6 h-6" />
          <span className="font-bold text-sm hidden sm:inline">Novo Produto</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 px-6 mt-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regular</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{products.filter((product) => product.status === 'ok').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baixo</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{products.filter((product) => product.status === 'low').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critico</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{products.filter((product) => product.status === 'critical').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entradas Hoje</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{todayEntryCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{productsRestockedToday} produtos repostos</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <MinusCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saidas Hoje</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{todayOutputCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{productsUsedToday} produtos com consumo</p>
        </div>
      </div>

      <div className="px-6 mt-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {(['all', 'ok', 'low', 'critical'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
              }`}
            >
              {status === 'all' ? 'Todos' : status === 'ok' ? 'Regular' : status === 'low' ? 'Baixo' : 'Critico'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Controle de Inventario</h3>
              <p className="text-xs text-slate-500">Historico das entradas e saidas manuais registradas no estoque.</p>
            </div>
            <div className="flex gap-3 sm:gap-6">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Entradas do dia</p>
                <p className="text-lg font-black text-emerald-600">+{entryQuantityToday}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saidas do dia</p>
                <p className="text-lg font-black text-rose-600">-{outputQuantityToday}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Movimentos Hoje</p>
                <p className="text-lg font-black text-slate-900">{movementEntriesToday.length}</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {movementEntries.length === 0 ? (
              <div className="p-6 text-sm text-slate-400 font-medium">Nenhuma movimentacao manual registrada ainda.</div>
            ) : (
              movementEntries.slice(0, 10).map((movement) => (
                <div key={`${movement.kind}-${movement.id}`} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 flex h-10 w-10 items-center justify-center rounded-2xl ${
                        movement.kind === 'entry' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {movement.kind === 'entry' ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900">{movement.productName}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            movement.kind === 'entry' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {movement.kind === 'entry' ? 'Entrada' : 'Saida'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {movement.note || (movement.kind === 'entry' ? 'Entrada manual' : 'Baixa manual')} •{' '}
                        {new Date(movement.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Movimento</p>
                      <p className={`text-sm font-black ${movement.kind === 'entry' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {movement.kind === 'entry' ? '+' : '-'}
                        {movement.quantity} {movement.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saldo Atual</p>
                      <p className="text-sm font-black text-slate-900">
                        {movement.currentQuantity} {movement.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900">Nenhum produto encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar os filtros ou adicione um novo produto.</p>
            </div>
          ) : (
            filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">{product.category}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getStatusColor(product.status)}`}>
                        {getStatusLabel(product.status)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 mt-2">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantidade</p>
                        <p className="text-sm font-black text-slate-900">
                          {product.quantity} <span className="text-xs font-medium text-slate-500">{product.unit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preco Un.</p>
                        <p className="text-sm font-black text-slate-900">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ultima Reposicao</p>
                        <p className="text-sm font-medium text-slate-600">{new Date(product.lastRestock).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entradas Hoje</p>
                        <p className="text-xs font-bold text-emerald-600">
                          +{getTodayEntryQuantity(product)} {product.unit}
                        </p>
                        {getLastEntry(product) && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Ultima entrada: {new Date(getLastEntry(product)!.createdAt).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saidas Hoje</p>
                        <p className="text-xs font-bold text-slate-700">
                          -{getTodayOutputQuantity(product)} {product.unit}
                        </p>
                        {getLastOutput(product) && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Ultima baixa: {new Date(getLastOutput(product)!.createdAt).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openManualEntry(product)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:border-emerald-300 transition-colors"
                        >
                          <PlusCircle className="w-4 h-4" />
                          Entrada Manual
                        </button>
                        <button
                          onClick={() => openManualOutput(product)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:border-primary hover:text-primary transition-colors"
                        >
                          <MinusCircle className="w-4 h-4" />
                          Baixa Manual
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === product.id ? null : product.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {openMenuId === product.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsAdding(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={() => openManualEntry(product)}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Entrada Manual
                          </button>
                          <button
                            onClick={() => openManualOutput(product)}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            Baixa Manual
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4 sm:items-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black text-slate-900">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Imagem do Produto</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                      {productImage ? (
                        <img src={productImage} alt="Preview do produto" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold">Sem imagem</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold file:text-slate-700"
                      />
                      <input
                        type="url"
                        value={productImage.startsWith('data:') ? '' : productImage}
                        onChange={(event) => setProductImage(event.target.value)}
                        placeholder="Ou informe a URL da imagem"
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome do Produto</label>
                  <input
                    name="name"
                    defaultValue={editingProduct?.name}
                    type="text"
                    placeholder="Ex: Shampoo Automotivo"
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                    <select
                      name="category"
                      defaultValue={editingProduct?.category}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900 appearance-none"
                      required
                    >
                      <option value="">Selecione...</option>
                      <option value="Limpeza Externa">Limpeza Externa</option>
                      <option value="Limpeza Interna">Limpeza Interna</option>
                      <option value="Acabamento">Acabamento</option>
                      <option value="Acessorios">Acessorios</option>
                      <option value="Limpeza Pesada">Limpeza Pesada</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Unidade</label>
                    <select
                      name="unit"
                      defaultValue={editingProduct?.unit}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900 appearance-none"
                      required
                    >
                      <option value="Unidades">Unidades</option>
                      <option value="Litros">Litros</option>
                      <option value="Caixas">Caixas</option>
                      <option value="Kits">Kits</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Quantidade Atual</label>
                    <input
                      name="quantity"
                      defaultValue={editingProduct?.quantity}
                      type="number"
                      min="0"
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Qtd. Minima</label>
                    <input
                      name="minQuantity"
                      defaultValue={editingProduct?.minQuantity}
                      type="number"
                      min="1"
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Preco Unitario (R$)</label>
                  <input
                    name="price"
                    defaultValue={editingProduct?.price}
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                    required
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    <span>Salvar Produto</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualEntryProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4 sm:items-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Entrada Manual</h3>
                  <p className="text-xs text-slate-500 mt-1">{manualEntryProduct.name}</p>
                </div>
                <button onClick={() => setManualEntryProduct(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estoque Atual</p>
                  <p className="text-lg font-black text-slate-900 mt-1">
                    {manualEntryProduct.quantity} {manualEntryProduct.unit}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Entradas Hoje</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">
                    +{getTodayEntryQuantity(manualEntryProduct)} {manualEntryProduct.unit}
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualEntry} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Quantidade Recebida</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={manualEntryQuantity}
                    onChange={(event) => setManualEntryQuantity(event.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Observacao</label>
                  <textarea
                    value={manualEntryNote}
                    onChange={(event) => setManualEntryNote(event.target.value)}
                    rows={3}
                    placeholder="Ex: reposicao recebida do almoxarifado"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Registrar Entrada</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualOutputProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4 sm:items-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Baixa Manual</h3>
                  <p className="text-xs text-slate-500 mt-1">{manualOutputProduct.name}</p>
                </div>
                <button onClick={() => setManualOutputProduct(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estoque Atual</p>
                  <p className="text-lg font-black text-slate-900 mt-1">
                    {manualOutputProduct.quantity} {manualOutputProduct.unit}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saidas Hoje</p>
                  <p className="text-lg font-black text-slate-900 mt-1">
                    {getTodayOutputQuantity(manualOutputProduct)} {manualOutputProduct.unit}
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualOutput} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Quantidade Consumida</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={manualOutputQuantity}
                    onChange={(event) => setManualOutputQuantity(event.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Observacao</label>
                  <textarea
                    value={manualOutputNote}
                    onChange={(event) => setManualOutputNote(event.target.value)}
                    rows={3}
                    placeholder="Ex: consumo do turno da tarde"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <MinusCircle className="w-5 h-5" />
                  <span>Registrar Baixa</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
