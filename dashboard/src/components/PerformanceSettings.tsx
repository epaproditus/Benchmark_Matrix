'use client';
import { useState, useEffect } from 'react';

interface Threshold {
    label: string;
    min: number;
    max: number;
    color?: string;
}

interface Config {
    labels: {
        xAxis: string;
        yAxis: string;
    };
    thresholds: {
        math: Threshold[];
        rla: Threshold[];
    };
}

export default function PerformanceSettings() {
    const [config, setConfig] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading settings:', err);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        if (!config) return;
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'An error occurred while saving.' });
        }
    };

    if (loading) return <div className="text-white p-8">Loading settings...</div>;
    if (!config) return <div className="text-red-500 p-8">Failed to load configuration.</div>;

    const updateLabel = (axis: 'xAxis' | 'yAxis', value: string) => {
        setConfig(prev => prev ? ({
            ...prev,
            labels: { ...prev.labels, [axis]: value }
        }) : null);
    };

    const updateThreshold = (subject: 'math' | 'rla', index: number, field: keyof Threshold, value: string | number) => {
        setConfig(prev => {
            if (!prev) return null;
            const newThresholds = [...prev.thresholds[subject]];
            newThresholds[index] = { ...newThresholds[index], [field]: value };
            return {
                ...prev,
                thresholds: { ...prev.thresholds, [subject]: newThresholds }
            };
        });
    };

    const renderThresholdInputs = (subject: 'math' | 'rla', title: string) => (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">{title} Thresholds</h3>
            <div className="grid gap-4">
                <div className="grid grid-cols-12 gap-2 text-sm text-gray-400 font-mono uppercase tracking-wider mb-2">
                    <div className="col-span-5">Label</div>
                    <div className="col-span-3">Min Score</div>
                    <div className="col-span-3">Max Score</div>
                    <div className="col-span-1">Color</div>
                </div>
                {config.thresholds[subject].map((t, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                            <input
                                className="w-full bg-black text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                                value={t.label}
                                onChange={(e) => updateThreshold(subject, i, 'label', e.target.value)}
                            />
                        </div>
                        <div className="col-span-3">
                            <input
                                type="number"
                                className="w-full bg-black text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                                value={t.min}
                                onChange={(e) => updateThreshold(subject, i, 'min', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="col-span-3">
                            <input
                                type="number"
                                className="w-full bg-black text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                                value={t.max}
                                onChange={(e) => updateThreshold(subject, i, 'max', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="col-span-1 flex justify-center">
                            <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: t.color }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-black text-white p-4 rounded-lg space-y-6">

            {/* Axis Labels Section */}
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">Axis Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Horizontal Axis (X-Axis) Label</label>
                        <input
                            className="w-full bg-black text-white px-3 py-2 rounded border border-gray-700 focus:border-white outline-none transition-colors text-sm"
                            value={config.labels.xAxis}
                            onChange={(e) => updateLabel('xAxis', e.target.value)}
                            placeholder="e.g. Current Benchmark"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Vertical Axis (Y-Axis) Label</label>
                        <input
                            className="w-full bg-black text-white px-3 py-2 rounded border border-gray-700 focus:border-white outline-none transition-colors text-sm"
                            value={config.labels.yAxis}
                            onChange={(e) => updateLabel('yAxis', e.target.value)}
                            placeholder="e.g. Previous Performance"
                        />
                    </div>
                </div>
            </div>

            {/* Threshold Sections */}
            {renderThresholdInputs('math', 'Mathematics')}
            {renderThresholdInputs('rla', 'Reading Language Arts')}

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 sticky bottom-6 bg-black/80 backdrop-blur p-4 rounded-xl border border-gray-800 shadow-2xl">
                {message && (
                    <span className={`px-3 py-1 rounded text-sm font-bold ${message.type === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                        {message.text}
                    </span>
                )}
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 rounded text-gray-400 hover:text-white transition-colors text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-white text-black font-bold rounded shadow-lg hover:bg-gray-200 transition-all hover:scale-105 text-sm"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}
