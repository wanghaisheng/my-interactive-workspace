import * as THREE from 'three';
import { TWEEN } from '/node_modules/three/examples/jsm/libs/tween.module.min.js';
import Delayed from '../../../../core/helpers/delayed-call';
import RoomObjectAbstract from '../room-object.abstract';
import { CHAIR_PART_CONFIG, CHAIR_PART_TYPE } from './chair-data';
import ChairDebug from './chair-debug';
import { ROOM_CONFIG } from '../../room-config';

export default class Chair extends RoomObjectAbstract {
  constructor(meshesGroup, roomObjectType) {
    super(meshesGroup, roomObjectType);

    this._chairDebug = null;

    this._init();
  }

  showWithAnimation(delay) {
    super.showWithAnimation();

    this._chairDebug.disable();
    this._setPositionForShowAnimation();

    Delayed.call(delay, () => {
      const fallDownTime = ROOM_CONFIG.startAnimation.objectFallDownTime;

      const legs = this._parts[CHAIR_PART_TYPE.Legs];
      const seat = this._parts[CHAIR_PART_TYPE.Seat];

      new TWEEN.Tween(legs.position)
        .to({ y: legs.userData.startPosition.y }, fallDownTime)
        .easing(ROOM_CONFIG.startAnimation.objectFallDownEasing)
        .start();

      new TWEEN.Tween(seat.position)
        .to({ y: seat.userData.startPosition.y }, fallDownTime)
        .easing(ROOM_CONFIG.startAnimation.objectFallDownEasing)
        .delay(fallDownTime * 0.5)
        .start();

      new TWEEN.Tween(seat.rotation)
        .to({ y: Math.PI * 2 }, fallDownTime * 3)
        .easing(TWEEN.Easing.Back.Out)
        .delay(fallDownTime * 0.5)
        .start()
        .onComplete(() => {
          this._chairDebug.enable();
          this._onShowAnimationComplete();
        });
    });
  }

  onClick(roomObject) {
    if (!this._isInputEnabled) {
      return;
    }

  }

  getMeshesForOutline(mesh) {
    return this._activeMeshes;
  }

  _setPositionForShowAnimation() {
    for (let key in this._parts) {
      const part = this._parts[key];
      part.position.y = part.userData.startPosition.y + ROOM_CONFIG.startAnimation.startPositionY;
    }

    this._parts[CHAIR_PART_TYPE.Seat].rotation.y = 0;
  }

  _init() {
    this._initParts(CHAIR_PART_TYPE, CHAIR_PART_CONFIG);
    this._addMaterials();
    this._addPartsToScene();
    this._initDebug();
  }

  _addPartsToScene() {
    for (let key in this._parts) {
      const part = this._parts[key];

      this.add(part);
    }
  }

  _initDebug() {
    const chairDebug = this._chairDebug = new ChairDebug();

    chairDebug.events.on('rotate', () => {
      console.log('rotate');
    });
  }
}
