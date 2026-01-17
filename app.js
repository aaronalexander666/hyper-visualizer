Const parser = new exprEval.Parser();

const app = {
    canvas: null,
    ctx: null,
    points: [],
    dimensions: 4,
    equation: "sin(x*2) * cos(y*2) + sin(z + t)",
    eqTarget: "color",
    paused: false,
    time: 0,
    rotation: { x: 0, y: 0, xw: 0 },
    autoSpeed: 0.5,
    timeScale: 1.0,
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
    width: 0,
    height: 0,

    init() {
        this.canvas = document.getElementById('gl-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Event listeners
        document.getElementById('dim-slider').addEventListener('input', e => {
            this.dimensions = +e.target.value;
            document.getElementById('dim-display').textContent = this.dimensions + 'D';
            this.generateParticles();
        });

        document.getElementById('count-slider').addEventListener('input', e => {
            document.getElementById('count-display').textContent = e.target.value;
            this.generateParticles();
        });

        document.getElementById('time-slider').addEventListener('input', e => {
            this.timeScale = +e.target.value;
            document.getElementById('time-display').textContent = this.timeScale.toFixed(1);
        });

        document.getElementById('rot-slider').addEventListener('input', e => {
            this.autoSpeed = +e.target.value;
        });

        document.getElementById('shape-select').addEventListener('change', () => this.generateParticles());

        document.getElementById('btn-compile').addEventListener('click', () => {
            const val = document.getElementById('eq-input').value.trim();
            try {
                parser.parse(val);
                this.equation = val;
                document.getElementById('active-equation').textContent = val.substring(0,15) + (val.length > 15 ? '...' : '');
                showToast("Equation applied", "success");
            } catch (e) {
                showToast("Invalid equation", "error");
            }
        });

        document.getElementById('btn-validate').addEventListener('click', () => {
            try {
                parser.parse(document.getElementById('eq-input').value);
                showToast("Syntax valid", "success");
            } catch (e) {
                showToast("Syntax error", "error");
            }
        });

        document.getElementById('eq-target').addEventListener('change', e => {
            this.eqTarget = e.target.value;
        });

        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const eq = {
                    wave: "sin(x*y - t) + cos(z*t)",
                    ripple: "sin(sqrt(x*x + y*y) - t*3)",
                    noise: "sin(x*3) + sin(y*3) + sin(z*3)",
                    tunnel: "1 / (x*x + y*y + 0.5)"
                }[btn.dataset.preset];

                document.getElementById('eq-input').value = eq;
                this.equation = eq;
                document.getElementById('active-equation').textContent = eq.substring(0,15) + '...';
                showToast(`Loaded: ${btn.textContent}`, "success");
            });
        });

        document.getElementById('reset-camera').addEventListener('click', () => {
            this.rotation = { x: 0, y: 0, xw: 0 };
            showToast("Camera reset", "success");
        });

        document.getElementById('toggle-pause').addEventListener('click', () => {
            this.paused = !this.paused;
            showToast(this.paused ? "Paused" : "Playing", "success");
        });

        // Mouse rotation
        this.canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.rotation.y += dx * 0.005;
            this.rotation.x += dy * 0.005;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        this.generateParticles();
        this.loop();
    },

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    },

    generateParticles() {
        this.points = [];
        const count = +document.getElementById('count-slider').value;
        const shape = document.getElementById('shape-select').value;

        for (let i = 0; i < count; i++) {
            let p = { x:0, y:0, z:0, w:0 };
            if (shape === 'cloud') {
                p.x = (Math.random()-0.5)*8;
                p.y = (Math.random()-0.5)*8;
                p.z = (Math.random()-0.5)*8;
                p.w = (Math.random()-0.5)*4;
            } else if (shape === 'sphere') {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 4;
                p.x = r * Math.sin(phi) * Math.cos(theta);
                p.y = r * Math.sin(phi) * Math.sin(theta);
                p.z = r * Math.cos(phi);
            } else if (shape === 'cube') {
                p.x = (Math.random()-0.5)*6;
                p.y = (Math.random()-0.5)*6;
                p.z = (Math.random()-0.5)*6;
                p.w = (Math.random()-0.5)*6;
            } else if (shape === 'torus') {
                const u = Math.random()*Math.PI*2;
                const v = Math.random()*Math.PI*2;
                const R = 3, r = 1;
                p.x = (R + r*Math.cos(v)) * Math.cos(u);
                p.y = (R + r*Math.cos(v)) * Math.sin(u);
                p.z = r * Math.sin(v);
            }
            this.points.push(p);
        }
    },

    evaluate(x,y,z,t,r) {
        try {
            const res = parser.evaluate(this.equation, {x,y,z,t,r});
            return isFinite(res) && !isNaN(res) ? res : 0;
        } catch {
            return 0;
        }
    },

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0,0,this.width,this.height);

        if (!this.paused) {
            this.time += 0.02 * this.timeScale;
            this.rotation.xw += 0.005 * this.autoSpeed;
        }

        ctx.globalCompositeOperation = 'lighter';

        const projected = [];

        for (const p of this.points) {
            const rad = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
            let val = this.evaluate(p.x, p.y, p.z, this.time, rad);

            let tx = p.x, ty = p.y, tz = p.z, tw = p.w;

            if (this.eqTarget === 'displace') {
                const safe = clamp(val, -4, 4);
                tz += safe;
                tw += safe;
            }

            if (this.dimensions >= 4) {
                const c = Math.cos(this.rotation.xw);
                const s = Math.sin(this.rotation.xw);
                const nx = tx * c - tw * s;
                const nw = tx * s + tw * c;
                tx = nx; tw = nw;
            }

            const dist = 5;
            const scale3 = this.dimensions >= 4 ? dist / (dist - tw) : 1;

            let x3 = tx * scale3;
            let y3 = ty * scale3;
            let z3 = tz * scale3;

            // Camera rotation
            let rx = x3 * Math.cos(this.rotation.y) - z3 * Math.sin(this.rotation.y);
            let rz = x3 * Math.sin(this.rotation.y) + z3 * Math.cos(this.rotation.y);
            x3 = rx; z3 = rz;

            let ry = y3 * Math.cos(this.rotation.x) - z3 * Math.sin(this.rotation.x);
            rz = y3 * Math.sin(this.rotation.x) + z3 * Math.cos(this.rotation.x);
            y3 = ry; z3 = rz;

            const fov = 800;
            const scale2d = fov / (6 + z3);

            if (scale2d > 0) {
                projected.push({
                    x: this.width/2 + x3 * scale2d,
                    y: this.height/2 + y3 * scale2d,
                    z: z3,
                    scale: scale2d * scale3,
                    val
                });
            }
        }

        projected.sort((a,b) => a.z - b.z);

        for (const p of projected) {
            let alpha = Math.max(0.15, 1 - p.z/30);
            let size = 2.5 * p.scale;

            if (this.eqTarget === 'size') {
                size *= clamp(Math.abs(p.val) + 0.5, 0.3, 6);
            }

            let hue = 210, sat = 90, light = 70;

            if (this.eqTarget === 'color') {
                const norm = Math.atan(p.val) / Math.PI;
                hue = 200 + norm * 140;
            }

            ctx.fillStyle = `hsla(\( {hue}, \){sat}%,\( {light}%, \){alpha})`;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `hsla(\( {hue}, \){sat}%,${light}%,0.7)`;

            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
    },

    loop() {
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
};

function showToast(msg, type = 'info') {
    const area = document.getElementById('toast-area');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${type==='error'?'#ef4444':'#00ff87'}"></span> ${msg}`;
    area.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    }, 2800);
}

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    showToast("Visualizer ready", "success");
});
