/**
 * input.js - 键盘输入映射模块
 * 将键盘按键映射到 NES 手柄按钮
 */
class InputManager {
  /**
   * @param {Emulator} emulator - 模拟器实例
   */
  constructor(emulator) {
    this.emulator = emulator;

    // jsnes Controller 按钮常量
    this.BUTTON = {
      A: 0,      // jsnes.Controller.BUTTON_A
      B: 1,      // jsnes.Controller.BUTTON_B
      SELECT: 2, // jsnes.Controller.BUTTON_SELECT
      START: 3,  // jsnes.Controller.BUTTON_START
      UP: 4,     // jsnes.Controller.BUTTON_UP
      DOWN: 5,   // jsnes.Controller.BUTTON_DOWN
      LEFT: 6,   // jsnes.Controller.BUTTON_LEFT
      RIGHT: 7,  // jsnes.Controller.BUTTON_RIGHT
    };

    // 键位映射：键盘按键 → [控制器编号, 按钮]
    this.keyMap = {
      // 玩家 1
      "ArrowUp":    [1, this.BUTTON.UP],
      "ArrowDown":  [1, this.BUTTON.DOWN],
      "ArrowLeft":  [1, this.BUTTON.LEFT],
      "ArrowRight": [1, this.BUTTON.RIGHT],
      "KeyZ":       [1, this.BUTTON.A],
      "KeyX":       [1, this.BUTTON.B],
      "Enter":      [1, this.BUTTON.START],
      "ShiftRight": [1, this.BUTTON.SELECT],

      // 玩家 2
      "KeyW": [2, this.BUTTON.UP],
      "KeyS": [2, this.BUTTON.DOWN],
      "KeyA": [2, this.BUTTON.LEFT],
      "KeyD": [2, this.BUTTON.RIGHT],
      "KeyJ": [2, this.BUTTON.A],
      "KeyK": [2, this.BUTTON.B],
      "KeyU": [2, this.BUTTON.START],
      "KeyI": [2, this.BUTTON.SELECT],
    };

    // 当前按下的键集合（防止重复触发）
    this.pressedKeys = new Set();

    // 绑定事件处理器
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  /**
   * 启动键盘监听
   */
  start() {
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
  }

  /**
   * 停止键盘监听
   */
  stop() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    this.pressedKeys.clear();
  }

  /**
   * 键盘按下处理
   */
  _onKeyDown(e) {
    const mapping = this.keyMap[e.code];
    if (!mapping) return;

    // 防止默认行为（方向键滚动页面等）
    e.preventDefault();

    // 防止按键重复触发
    if (this.pressedKeys.has(e.code)) return;
    this.pressedKeys.add(e.code);

    const [controller, button] = mapping;
    this.emulator.buttonDown(controller, button);
  }

  /**
   * 键盘松开处理
   */
  _onKeyUp(e) {
    const mapping = this.keyMap[e.code];
    if (!mapping) return;

    e.preventDefault();
    this.pressedKeys.delete(e.code);

    const [controller, button] = mapping;
    this.emulator.buttonUp(controller, button);
  }

  /**
   * 窗口失焦时释放所有按键
   */
  _onBlur() {
    for (const code of this.pressedKeys) {
      const mapping = this.keyMap[code];
      if (mapping) {
        const [controller, button] = mapping;
        this.emulator.buttonUp(controller, button);
      }
    }
    this.pressedKeys.clear();
  }
}
