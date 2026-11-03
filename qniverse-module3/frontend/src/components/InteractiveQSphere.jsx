import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

const parseComplexStr = (cStr) => {
    // Input could be "(0.5+0.5j)", "(-0.5-0.5j)", "(1+0j)", "1j", "-1j"
    let s = String(cStr).replace(/[() ]/g, '').replace('j', 'i');

    let r = 0;
    let i = 0;

    // Robust regex to split the signed complex parts appropriately
    const regex = /([+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)(i?)/g;

    let match;
    while ((match = regex.exec(s)) !== null) {
        const val = parseFloat(match[1]);
        if (match[2] === 'i') i = val;
        else r = val;
    }

    return { r, i };
};

const InteractiveQSphere = ({ statevectorData, onClose }) => {
    const plotData = useMemo(() => {
        if (!statevectorData) return [];

        const receivedStates = Object.keys(statevectorData);
        if (receivedStates.length === 0) return [];

        const numQubits = receivedStates[0].length;
        const totalStates = Math.pow(2, numQubits);

        // Generate ALL 2^n basis states (the backend only sends non-zero ones)
        const allStates = [];
        if (numQubits <= 10) {
            // For up to 10 qubits (1024 states), generate every single basis state
            for (let i = 0; i < totalStates; i++) {
                allStates.push(i.toString(2).padStart(numQubits, '0'));
            }
        } else {
            // For larger circuits, only use what the backend sent to avoid browser lag
            allStates.push(...receivedStates);
        }

        // 1. Group ALL states by Hamming Weight (number of '1's)
        const weightGroups = {};
        allStates.forEach(state => {
            const weight = state.split('').filter(b => b === '1').length;
            if (!weightGroups[weight]) weightGroups[weight] = [];
            weightGroups[weight].push(state);
        });

        // Pre-sort all topological groups once mathematically
        Object.values(weightGroups).forEach(group => group.sort());

        // 2. Parse Statevector math and plot dynamically over coordinates
        let activeX = [], activeY = [], activeZ = [], activeText = [], activeColors = [], activeSizes = [];
        let inactiveX = [], inactiveY = [], inactiveZ = [], inactiveText = [];

        allStates.forEach((state) => {
            const weight = state.split('').filter(b => b === '1').length;

            // Use the amplitude from the backend data, or default to zero
            const ampStr = statevectorData[state];
            const { r, i } = ampStr ? parseComplexStr(ampStr) : { r: 0, i: 0 };

            const prob = r * r + i * i;

            let phase = Math.atan2(i, r);
            if (phase < 0) phase += 2 * Math.PI;

            // Latitude Z goes down as weight increases
            const zPos = 1 - (2 * weight / numQubits);
            const radius = Math.sqrt(1 - zPos * zPos);

            // Fetch pre-sorted angle index mapping
            const group = weightGroups[weight];
            const index = group.indexOf(state);
            const angle = group.length > 0 ? (2 * Math.PI * index) / group.length : 0;

            const xPos = radius * Math.cos(angle);
            const yPos = radius * Math.sin(angle);

            const probPct = (prob * 100).toFixed(4);
            const phasePi = (phase / Math.PI).toFixed(2);
            const label = `|${state}⟩<br>Prob: ${probPct}%<br>Phase: ${phasePi}π`;

            if (prob < 0.00001) {
                inactiveX.push(xPos);
                inactiveY.push(yPos);
                inactiveZ.push(zPos);
                inactiveText.push(label);
            } else {
                activeX.push(xPos);
                activeY.push(yPos);
                activeZ.push(zPos);
                activeText.push(label);
                activeColors.push(phase);
                activeSizes.push(Math.max(10, prob * 40));
            }
        });

        // 3. Render Globe Mesh (Underlying Frame Reference)
        const u = [], v = [], xSphere = [], ySphere = [], zSphere = [];
        for (let i = 0; i <= 24; i++) u.push(i * Math.PI / 24);
        for (let j = 0; j <= 24; j++) v.push(j * 2 * Math.PI / 24);

        for (let i = 0; i <= 24; i++) {
            const xs = [], ys = [], zs = [];
            for (let j = 0; j <= 24; j++) {
                xs.push(Math.sin(u[i]) * Math.cos(v[j]));
                ys.push(Math.sin(u[i]) * Math.sin(v[j]));
                zs.push(Math.cos(u[i]));
            }
            xSphere.push(xs);
            ySphere.push(ys);
            zSphere.push(zs);
        }

        const sphereSurface = {
            type: 'surface',
            x: xSphere, y: ySphere, z: zSphere,
            opacity: 0.1,
            colorscale: [['0', '#cccccc'], ['1', '#cccccc']],
            showscale: false,
            hoverinfo: 'skip',
            contours: {
                x: { show: true, color: '#dddddd', width: 2, highlight: false },
                y: { show: true, color: '#dddddd', width: 2, highlight: false },
                z: { show: true, color: '#dddddd', width: 2, highlight: false }
            }
        };

        const activeStatePoints = {
            type: 'scatter3d',
            mode: numQubits <= 6 ? 'markers+text' : 'markers',
            name: 'Active States',
            x: activeX, y: activeY, z: activeZ,
            text: activeText,
            textfont: {
                color: '#000000',
                size: 16,
                family: 'Consolas, monospace',
                weight: 'bold'
            },
            textposition: 'top center',
            hoverinfo: 'text',
            marker: {
                size: activeSizes.map(s => Math.max(14, s)),
                color: activeColors,
                colorscale: 'HSV',
                cmin: 0,
                cmax: 2 * Math.PI,
                opacity: 1,
                line: { width: 2, color: '#000000' },
                colorbar: {
                    title: { text: 'Phase (π)', font: { color: '#24292e' } },
                    tickfont: { color: '#24292e' },
                    tickvals: [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI],
                    ticktext: ['0', '0.5π', 'π', '1.5π', '2π']
                }
            }
        };

        // Build concise labels for inactive states (state name + 0%)
        const inactiveLabelsShort = inactiveX.map((_, idx) => {
            const full = inactiveText[idx];
            const stateMatch = full.match(/\|([01]+)⟩/);
            return stateMatch ? `|${stateMatch[1]}⟩ 0%` : '';
        });

        const inactiveStatePoints = {
            type: 'scatter3d',
            mode: numQubits <= 5 ? 'markers+text' : 'markers',
            name: 'Inactive States (0%)',
            x: inactiveX, y: inactiveY, z: inactiveZ,
            text: numQubits <= 5 ? inactiveLabelsShort : inactiveText,
            hovertext: inactiveText,
            hoverinfo: 'text',
            textfont: {
                color: '#110101ff',
                size: 20,
                family: 'Consolas, monospace',
                weight: 'bold'
            },
            textposition: 'bottom center',
            marker: {
                size: 9,
                color: '#9d0000ff',
                opacity: 1,
                line: { width: 2, color: '#311B92' },
                symbol: 'circle',
            },
            showlegend: true
        };

        const axesLines = {
            type: 'scatter3d',
            mode: 'lines',
            x: [-1.2, 1.2, null, 0, 0, null, 0, 0],
            y: [0, 0, null, -1.2, 1.2, null, 0, 0],
            z: [0, 0, null, 0, 0, null, -1.2, 1.2],
            line: { color: '#888888', width: 3 },
            hoverinfo: 'none',
            showlegend: false
        };

        const axesLabels = {
            type: 'scatter3d',
            mode: 'text',
            x: [1.3, 0, 0],
            y: [0, 1.3, 0],
            z: [0, 0, 1.3],
            text: ['X', 'Y', 'Z'],
            textfont: { color: '#0366d6', size: 16, weight: 'bold' },
            hoverinfo: 'none',
            showlegend: false
        };

        return [sphereSurface, axesLines, axesLabels, inactiveStatePoints, activeStatePoints];
    }, [statevectorData]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(240, 247, 255, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
            <div style={{ position: 'absolute', top: '20px', right: '30px', zIndex: 3001 }}>
                <button onClick={onClose} style={{ background: '#ffffff', color: '#ff4d4f', border: '1px solid #ff4d4f', borderRadius: '5px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}> Close 3D Workspace </button>
            </div>

            <div style={{ width: '90%', height: '90%', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e4e8', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)' }}>
                <Plot
                    data={plotData}
                    layout={{
                        autosize: true,
                        margin: { l: 0, r: 0, b: 0, t: 60 },
                        title: { text: "Interactive Phase-Mapped Q-Sphere", font: { color: '#0366d6', size: 20, family: 'Segoe UI, sans-serif', weight: 'bold' } },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        scene: {
                            xaxis: { showgrid: false, zeroline: false, showbackground: false, showline: false, showticklabels: false, showspikes: false, title: '' },
                            yaxis: { showgrid: false, zeroline: false, showbackground: false, showline: false, showticklabels: false, showspikes: false, title: '' },
                            zaxis: { showgrid: false, zeroline: false, showbackground: false, showline: false, showticklabels: false, showspikes: false, title: '' },
                            camera: { eye: { x: 1.5, y: 1.5, z: 0.5 } },
                            aspectmode: 'cube'
                        }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        </div>
    );
};

export default InteractiveQSphere;
