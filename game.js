/* Eu vs Inma — endless runner estilo Dino. Phaser 3. */

// ancho del mundo dinámico = encaja el aspecto real del dispositivo (alto fijo).
// así Scale.FIT llena la pantalla sin barras y el suelo queda siempre abajo.
const H = 540;
const _ar = (window.innerWidth || 960) / (window.innerHeight || 540);
const W = Phaser.Math.Clamp(Math.round(H * _ar), 760, 1500);
const GROUND_H = 64;
const GROUND_Y = H - GROUND_H;        // y del suelo (pies del jugador)
const PLAYER_X = W * 0.18;

// ---- definición de personajes / enemigos / items ----
const CHARS = {
  eu:   { idle:'00', run:['02','03','04','05'], jumpUp:'11', jumpDown:'12', duck:'15', label:'EU' },
  inma: { idle:'00', run:['03','04','05','06','07','08','09','10'], jumpUp:'20', jumpDown:'20', duck:'22', label:'INMA' },
};
const ENEMIES = {
  javi: { dir:'javi', idle:'00', run:['15','16','17','18','19','20'] },
};
const ITEMS = [
  { key:'it_phone', file:'10', score:20,  type:'score', tint:0x6cf0c0 },
  { key:'it_pack',  file:'01', score:25,  type:'score', tint:0xffe27a },
  { key:'it_bottle',file:'05', score:30,  type:'score', tint:0xffb347 },
  { key:'it_pear',  file:'13', score:60,  type:'score', tint:0xb98cff },
  { key:'it_beer',  file:'08', score:0,   type:'shield',tint:0x7ad7ff },
];

const HS_KEY = 'euinma_highscore';

// ---- efectos de sonido sintetizados (WebAudio, sin ficheros) ----
const Sfx = {
  ctx: null, muted: false,
  init(){
    if (!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type='square', vol=0.2, slideTo=null){
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  jump(){ this.tone(420, 0.18, 'square', 0.18, 760); },
  coin(){ this.tone(880, 0.07, 'square', 0.16); setTimeout(()=>this.tone(1320, 0.12, 'square', 0.16), 55); },
  power(){ this.tone(300, 0.35, 'sawtooth', 0.18, 950); setTimeout(()=>this.tone(700, 0.25, 'square', 0.14), 120); },
  hit(){ this.tone(220, 0.5, 'sawtooth', 0.25, 60); },
  select(){ this.tone(660, 0.1, 'square', 0.16); },
};

// ===================================================================
class Preload extends Phaser.Scene {
  constructor(){ super('Preload'); }
  preload(){
    const cx = W/2, cy = H/2;
    this.add.text(cx, cy-50, 'CARGANDO…', {fontFamily:'monospace',fontSize:'24px',color:'#cfe8ff'}).setOrigin(0.5);
    const bar = this.add.graphics();
    this.load.on('progress', p => {
      bar.clear().fillStyle(0x2a3350).fillRect(cx-150,cy,300,16)
         .fillStyle(0x6cf0c0).fillRect(cx-150,cy,300*p,16);
    });

    this.load.image('sky','assets/bg/sky.png');
    this.load.image('far','assets/bg/far.png');
    this.load.image('mid','assets/bg/mid.png');

    // personajes
    for (const [name,c] of Object.entries(CHARS)){
      this.load.image(`${name}_idle`, `assets/${name}/${c.idle}.png`);
      this.load.image(`${name}_jumpup`, `assets/${name}/${c.jumpUp}.png`);
      this.load.image(`${name}_jumpdn`, `assets/${name}/${c.jumpDown}.png`);
      this.load.image(`${name}_duck`, `assets/${name}/${c.duck}.png`);
      c.run.forEach((f,i)=> this.load.image(`${name}_run${i}`, `assets/${name}/${f}.png`));
    }
    // enemigos
    for (const [name,e] of Object.entries(ENEMIES)){
      this.load.image(`${name}_idle`, `assets/${e.dir}/${e.idle}.png`);
      e.run.forEach((f,i)=> this.load.image(`${name}_run${i}`, `assets/${e.dir}/${f}.png`));
    }
    // items
    ITEMS.forEach(it => this.load.image(it.key, `assets/objetos/${it.file}.png`));
  }
  create(){
    makeGroundTexture(this);
    this.scene.start('Menu');
  }
}

// ===================================================================
class Menu extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    drawParallax(this, true);
    this.add.rectangle(0,0,W,H,0x10131f,0.35).setOrigin(0);

    this.add.text(W/2, 64, 'EU & INMA', {fontFamily:'monospace',fontSize:'52px',color:'#ffffff',
      stroke:'#1b2440',strokeThickness:8}).setOrigin(0.5);
    this.add.text(W/2, 110, 'Misión cerveza y cigarro', {fontFamily:'monospace',fontSize:'22px',color:'#6cf0c0'}).setOrigin(0.5);
    this.add.text(W/2, 138, 'Con la aparición estelar de el pelopolla',
      {fontFamily:'monospace',fontSize:'14px',color:'#ff9ed8',fontStyle:'italic'}).setOrigin(0.5);

    const hs = +(localStorage.getItem(HS_KEY)||0);
    this.add.text(W/2, 164, `RÉCORD: ${hs}`, {fontFamily:'monospace',fontSize:'16px',color:'#ffe27a'}).setOrigin(0.5);

    this.add.text(W/2, 200, 'Elige tu personaje', {fontFamily:'monospace',fontSize:'22px',color:'#cfe8ff'}).setOrigin(0.5);

    this.makeChoice('eu',  W/2-170, 360, 'EU');
    this.makeChoice('inma',W/2+170, 360, 'INMA');

    this.add.text(W/2, H-34,
      'Saltar: toca arriba / SPACE · Agacharse: mantén abajo / ↓',
      {fontFamily:'monospace',fontSize:'14px',color:'#9fb4d8'}).setOrigin(0.5);
  }
  makeChoice(name, x, y, label){
    const tex = this.textures.get(`${name}_idle`).getSourceImage();
    const scale = 170 / tex.height;
    const card = this.add.rectangle(x, y, 230, 250, 0x223052, 0.85)
      .setStrokeStyle(3, 0x3d5488).setInteractive({useHandCursor:true});
    const spr = this.add.image(x, y+70, `${name}_idle`).setOrigin(0.5,1).setScale(scale);
    const txt = this.add.text(x, y-95, label, {fontFamily:'monospace',fontSize:'28px',color:'#ffffff'}).setOrigin(0.5);
    this.tweens.add({targets:spr, y:y+62, duration:900, yoyo:true, repeat:-1, ease:'Sine.inOut'});

    const hi = ()=>{ card.setStrokeStyle(4,0x6cf0c0); txt.setColor('#6cf0c0'); };
    const lo = ()=>{ card.setStrokeStyle(3,0x3d5488); txt.setColor('#ffffff'); };
    card.on('pointerover', hi); card.on('pointerout', lo);
    card.on('pointerdown', ()=>{
      Sfx.init(); Sfx.select();          // gesto de usuario: desbloquea audio
      this.registry.set('char', name);
      this.cameras.main.fadeOut(220,0,0,0);
      this.time.delayedCall(230, ()=> this.scene.start('Play'));
    });
  }
}

// ===================================================================
class Play extends Phaser.Scene {
  constructor(){ super('Play'); }

  create(){
    this.charName = this.registry.get('char') || 'eu';
    this.speed = 340;
    this.score = 0;
    this.gameOver = false;
    this.shield = false;

    drawParallax(this, false);

    // suelo (tileSprite que se desplaza)
    this.ground = this.add.tileSprite(0, GROUND_Y, W, GROUND_H, 'groundtex').setOrigin(0,0);
    this.physics.add.existing(this.ground, true);
    this.ground.body.setSize(W, GROUND_H).setOffset(0,0);

    this.buildAnims();

    // jugador
    const p = this.physics.add.sprite(PLAYER_X, GROUND_Y, `${this.charName}_run0`).setOrigin(0.5,1);
    p.scaleY = p.scaleX = 138 / p.height;
    p.setCollideWorldBounds(true);
    setBody(p, 0.40, 0.66);
    p.play(`${this.charName}_run`);
    this.player = p;
    this.physics.add.collider(p, this.ground);
    this.ducking = false;

    // grupos
    this.obstacles = this.physics.add.group();
    this.items = this.physics.add.group();
    this.physics.add.overlap(p, this.obstacles, this.hitObstacle, this.canHit, this);
    this.physics.add.overlap(p, this.items, this.collectItem, null, this);

    // HUD
    this.scoreText = this.add.text(W-20, 18, '0', {fontFamily:'monospace',fontSize:'30px',color:'#ffffff',
      stroke:'#1b2440',strokeThickness:5}).setOrigin(1,0).setScrollFactor(0).setDepth(50);
    const hs = +(localStorage.getItem(HS_KEY)||0);
    this.hsText = this.add.text(W-20, 52, `HI ${hs}`, {fontFamily:'monospace',fontSize:'16px',color:'#ffe27a'})
      .setOrigin(1,0).setScrollFactor(0).setDepth(50);
    this.shieldText = this.add.text(20, 18, '', {fontFamily:'monospace',fontSize:'18px',color:'#7ad7ff'})
      .setScrollFactor(0).setDepth(50);

    // botón mute
    Sfx.init();
    this.muteBtn = this.add.text(20, 48, Sfx.muted?'🔇':'🔊', {fontSize:'22px'})
      .setScrollFactor(0).setDepth(50).setInteractive({useHandCursor:true});
    this.muteBtn.on('pointerdown', (p,x,y,e)=>{ e&&e.stopPropagation(); Sfx.muted=!Sfx.muted; this.muteBtn.setText(Sfx.muted?'🔇':'🔊'); });

    this.setupInput();

    // spawns
    this.obTimer = this.time.addEvent({ delay:1500, callback:this.spawnObstacle, callbackScope:this, loop:true });
    this.itTimer = this.time.addEvent({ delay:2600, callback:this.spawnItem,     callbackScope:this, loop:true });

    this.cameras.main.fadeIn(220,0,0,0);
  }

  buildAnims(){
    const mk = (key, frames, rate)=>{
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: frames.map(k=>({key:k})), frameRate:rate, repeat:-1 });
    };
    const c = this.charName;
    mk(`${c}_run`, CHARS[c].run.map((_,i)=>`${c}_run${i}`), 14);
    for (const e of Object.keys(ENEMIES))
      mk(`${e}_run`, ENEMIES[e].run.map((_,i)=>`${e}_run${i}`), 13);
  }

  setupInput(){
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', ()=>this.jump());
    this.input.keyboard.on('keydown-UP', ()=>this.jump());
    this.input.keyboard.on('keydown-DOWN', ()=>this.setDuck(true));
    this.input.keyboard.on('keyup-DOWN', ()=>this.setDuck(false));

    this.addTouchButtons();

    this.input.on('pointerdown', (p)=>{
      if (this.gameOver) return;
      if (this._overBtn(p)) return;        // los botones se gestionan solos
      this.jump();                         // tocar en cualquier otro sitio = saltar
    });
  }

  // botones en pantalla para móvil: izq agacharse (mantener), der saltar
  addTouchButtons(){
    const bw = 150, bh = 76, y = H - 56;
    const make = (x, label, col)=>{
      const c = this.add.rectangle(x, y, bw, bh, col, 0.30).setStrokeStyle(3, col, 0.95)
        .setScrollFactor(0).setDepth(70).setInteractive({useHandCursor:true});
      this.add.text(x, y, label, {fontFamily:'monospace',fontSize:'24px',color:'#ffffff',
        stroke:'#1b2440',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(71);
      return c;
    };
    this.jumpBtn = make(W - bw/2 - 24, '▲ SALTAR', 0x6cf0c0);
    this.duckBtn = make(bw/2 + 24, 'AGACHAR ▼', 0xffb347);

    this.jumpBtn.on('pointerdown', (p,x,y,e)=>{ e&&e.stopPropagation(); this.jump(); });

    const duckOn  = (p,x,y,e)=>{ e&&e.stopPropagation(); this._duckPtr = p.id; this.setDuck(true); };
    const duckOff = (p)=>{ if (!p || p.id === this._duckPtr){ this._duckPtr = null; this.setDuck(false); } };
    this.duckBtn.on('pointerdown', duckOn);
    this.duckBtn.on('pointerup', duckOff);
    this.duckBtn.on('pointerout', duckOff);
  }

  _overBtn(p){
    for (const b of [this.jumpBtn, this.duckBtn, this.muteBtn]){
      if (b && b.getBounds().contains(p.x, p.y)) return true;
    }
    return false;
  }

  jump(){
    if (this.gameOver) return;
    const p = this.player;
    if (p.body.blocked.down || p.body.touching.down){
      p.setVelocityY(-1080);
      this.setDuck(false);
      Sfx.jump();
    }
  }

  setDuck(on){
    if (this.gameOver) return;
    const p = this.player;
    if (on && !(p.body.blocked.down || p.body.touching.down)) return; // sólo en suelo
    if (this.ducking === on) return;
    this.ducking = on;
    if (on){
      p.setTexture(`${this.charName}_duck`); p.stop();
      setBody(p, 0.42, 0.40);
    } else {
      p.play(`${this.charName}_run`);
      setBody(p, 0.40, 0.66);
    }
  }

  // -------- spawns --------
  spawnObstacle(){
    if (this.gameOver) return;
    const ename = Phaser.Math.RND.pick(Object.keys(ENEMIES));
    const roll = Math.random();
    let kind;
    if (roll < 0.55) kind = 'walk';      // camina lento -> saltar
    else if (roll < 0.82) kind = 'run';  // corre rápido -> saltar
    else kind = 'fly';                   // alto -> agacharse

    let texKey, y, extra, anim=false;
    if (kind === 'fly'){
      texKey = `${ename}_idle`;
      y = GROUND_Y - 60;                 // flotando: hay que agacharse
      extra = 40;
    } else {
      texKey = kind==='run' ? `${ename}_run0` : `${ename}_idle`;
      y = GROUND_Y;
      extra = kind==='run' ? 170 : 30;
      anim = kind==='run';
    }

    const o = this.obstacles.create(W + 80, y, texKey).setOrigin(0.5,1);
    o.scaleY = o.scaleX = 124 / o.height;
    o.body.setAllowGravity(false);
    o.setVelocityX(-(this.speed + extra));
    setBody(o, 0.42, 0.7);
    o.setData('fly', kind==='fly');
    o.setData('extra', extra);
    if (anim) o.play(`${ename}_run`);
    // corriendo (anim): mira a la izquierda (frames 13-20). Parado/flotante: idle espejado mirando a la derecha.
    o.setFlipX(!anim);

    // siguiente spawn con separación que escala con la velocidad
    this.obTimer.delay = Phaser.Math.Between(700, 1300) * (340/this.speed) + 350;
  }

  spawnItem(){
    if (this.gameOver) return;
    const it = Phaser.Math.RND.weightedPick(ITEMS.concat(ITEMS.slice(0,1))); // algo más de score comunes
    const high = Math.random() < 0.5;
    const y = high ? GROUND_Y - Phaser.Math.Between(120,180) : GROUND_Y - 40;
    const s = this.items.create(W + 60, y, it.key).setOrigin(0.5,1);
    s.scaleY = s.scaleX = 52 / s.height;
    s.body.setAllowGravity(false);
    s.setVelocityX(-this.speed);
    setBody(s, 0.7, 0.7);
    s.setData('item', it);
    this.tweens.add({targets:s, y:y-10, duration:700, yoyo:true, repeat:-1, ease:'Sine.inOut'});
    this.itTimer.delay = Phaser.Math.Between(1800, 3200);
  }

  // -------- colisiones --------
  canHit(player, o){
    if (this.shield) return false;
    return true;
  }
  hitObstacle(player, o){
    if (this.shield){ return; }
    this.endGame();
  }
  collectItem(player, s){
    const it = s.getData('item');
    this.tweens.killTweensOf(s);
    if (it.type === 'shield'){ this.activateShield(); Sfx.power(); }
    else { this.score += it.score; this.popText(s.x, s.y, `+${it.score}`, '#ffe27a'); Sfx.coin(); }
    s.destroy();
  }

  activateShield(){
    this.shield = true;
    this.popText(this.player.x, this.player.y-120, 'CERVEZA! INVULNERABLE', '#7ad7ff');
    this.player.setTint(0x7ad7ff);
    if (this._shieldEvt) this._shieldEvt.remove();
    let t = 6;
    this.shieldText.setText('🛡 '+t);
    this._shieldEvt = this.time.addEvent({ delay:1000, repeat:5, callback:()=>{
      t--; this.shieldText.setText('🛡 '+t);
      if (t<=0){ this.shield=false; this.shieldText.setText(''); this.player.clearTint(); }
    }});
    // parpadeo
    this.tweens.add({targets:this.player, alpha:0.55, duration:140, yoyo:true, repeat:20,
      onComplete:()=>this.player.setAlpha(1)});
  }

  popText(x,y,msg,color){
    const t = this.add.text(x,y,msg,{fontFamily:'monospace',fontSize:'18px',color,stroke:'#1b2440',strokeThickness:4}).setOrigin(0.5).setDepth(60);
    this.tweens.add({targets:t, y:y-40, alpha:0, duration:700, onComplete:()=>t.destroy()});
  }

  endGame(){
    if (this.gameOver) return;
    this.gameOver = true;
    Sfx.hit();
    this.physics.pause();
    this.obTimer.remove(); this.itTimer.remove();
    this.player.setTint(0xff5555);
    const final = Math.floor(this.score);
    const hs = Math.max(final, +(localStorage.getItem(HS_KEY)||0));
    localStorage.setItem(HS_KEY, hs);
    this.cameras.main.shake(250, 0.012);
    this.time.delayedCall(600, ()=> this.scene.start('GameOver', {score:final, hs, char:this.charName}));
  }

  update(_, dt){
    if (this.gameOver) return;
    const f = dt/1000;
    // dificultad progresiva
    this.speed = Math.min(820, this.speed + 7*f);
    this.score += this.speed * f * 0.03;
    this.scoreText.setText(Math.floor(this.score));

    // parallax + suelo
    this.far.tilePositionX += this.speed * f * 0.18;
    this.mid.tilePositionX += this.speed * f * 0.45;
    this.ground.tilePositionX += this.speed * f;

    // mantener velocidad de obstáculos/items acorde a la velocidad actual
    this.obstacles.children.iterate(o=>{
      if (!o) return;
      if (o.x < -120){ o.destroy(); return; }
      o.setVelocityX(-(this.speed + (o.getData('extra')||0)));  // sincroniza con la rampa
    });
    this.items.children.iterate(s=>{
      if (!s) return;
      if (s.x < -80){ this.tweens.killTweensOf(s); s.destroy(); return; }
      s.setVelocityX(-this.speed);
    });

    // estado de animación del jugador
    if (!this.ducking){
      const grounded = this.player.body.blocked.down || this.player.body.touching.down;
      if (grounded){
        this.player.play(`${this.charName}_run`, true);   // reanuda si estaba parada
      } else {
        this.player.stop();
        const up = this.player.body.velocity.y < 0;   // subiendo = peak, cayendo = land
        this.player.setTexture(`${this.charName}_${up ? 'jumpup' : 'jumpdn'}`);
      }
    }
  }
}

// ===================================================================
class GameOver extends Phaser.Scene {
  constructor(){ super('GameOver'); }
  create(data){
    drawParallax(this, true);
    this.add.rectangle(0,0,W,H,0x10131f,0.55).setOrigin(0);

    this.add.text(W/2, 120, 'GAME OVER', {fontFamily:'monospace',fontSize:'56px',color:'#ff6b6b',
      stroke:'#1b2440',strokeThickness:8}).setOrigin(0.5);
    this.add.text(W/2, 210, `Puntuación: ${data.score}`, {fontFamily:'monospace',fontSize:'30px',color:'#ffffff'}).setOrigin(0.5);
    const isNew = data.score >= data.hs && data.score>0;
    this.add.text(W/2, 250, isNew ? '¡NUEVO RÉCORD!' : `Récord: ${data.hs}`,
      {fontFamily:'monospace',fontSize:'20px',color: isNew?'#6cf0c0':'#ffe27a'}).setOrigin(0.5);

    const btn = (x, label, cb)=>{
      const b = this.add.rectangle(x, 360, 220, 64, 0x223052, 0.95).setStrokeStyle(3,0x3d5488)
        .setInteractive({useHandCursor:true});
      const t = this.add.text(x, 360, label, {fontFamily:'monospace',fontSize:'22px',color:'#ffffff'}).setOrigin(0.5);
      b.on('pointerover',()=>{b.setStrokeStyle(4,0x6cf0c0);t.setColor('#6cf0c0');});
      b.on('pointerout', ()=>{b.setStrokeStyle(3,0x3d5488);t.setColor('#ffffff');});
      b.on('pointerdown', cb);
    };
    btn(W/2-130, 'REINTENTAR', ()=>{ this.registry.set('char', data.char); this.scene.start('Play'); });
    btn(W/2+130, 'MENÚ', ()=> this.scene.start('Menu'));
  }
}

// ===================================================================
// helpers
function setBody(spr, wRatio, hRatio){
  const tw = spr.width, th = spr.height;
  const bw = tw*wRatio, bh = th*hRatio;
  spr.body.setSize(bw, bh);
  spr.body.setOffset((tw-bw)/2, th-bh);  // anclado abajo-centro
}

function drawParallax(scene, menu){
  scene.add.image(0,0,'sky').setOrigin(0).setDisplaySize(W,H);
  const farScale = (H*0.78)/346;
  scene.far = scene.add.tileSprite(0, H, W, 346, 'far').setOrigin(0,1).setTileScale(1,1);
  scene.mid = scene.add.tileSprite(0, H, W, 346, 'mid').setOrigin(0,1);
  // banda de suelo bajo el skyline
  scene.add.rectangle(0, GROUND_Y, W, GROUND_H, 0x2b2336).setOrigin(0,0);
  if (menu){
    scene.add.tileSprite(0, GROUND_Y, W, GROUND_H, 'groundtex').setOrigin(0,0);
  }
}

function makeGroundTexture(scene){
  const g = scene.add.graphics();
  const size = 64;
  g.fillStyle(0x3a2f47).fillRect(0,0,size,size);
  g.fillStyle(0x4a3d5c).fillRect(0,0,size,6);            // borde superior claro
  g.fillStyle(0x2c2438);
  for (let i=0;i<14;i++){
    const x = Phaser.Math.Between(2,size-6), y = Phaser.Math.Between(10,size-4);
    g.fillRect(x,y,Phaser.Math.Between(2,5),Phaser.Math.Between(2,4));
  }
  g.lineStyle(2,0x231b30).strokeRect(0,6,size,size-6);
  g.generateTexture('groundtex', size, size);
  g.destroy();
}

// ===================================================================
const config = {
  type: Phaser.AUTO,
  width: W, height: H,
  parent: 'game',
  backgroundColor: '#9fd6e0',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default:'arcade', arcade:{ gravity:{y:2600}, debug:false } },
  scene: [Preload, Menu, Play, GameOver],
};
window.game = new Phaser.Game(config);
