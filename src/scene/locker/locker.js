import * as THREE from 'three';
import { TWEEN } from '/node_modules/three/examples/jsm/libs/tween.module.min.js';
import { OBJECT_TYPE } from '../scene3d';
import { LOCKER_CASES_ANIMATION_SEQUENCE, LOCKER_CASES_ANIMATION_TYPE, LOCKER_CASES_RANDOM_ANIMATIONS, LOCKER_CASE_MOVE_DIRECTION, LOCKER_CASE_STATE, LOCKER_PART_NAME, LOCKER_PART_NAME_TO_DELETE, LOCKER_PART_TYPE } from './locker-data';
import LOCKER_CONFIG from './locker-config';
import LockerDebug from './locker-debug';

export default class Locker extends THREE.Group {
  constructor(lockerGroup) {
    super();

    this._lockerGroup = lockerGroup;
    this._objectType = OBJECT_TYPE.Locker;
    this._currentAnimationType = LOCKER_CASES_RANDOM_ANIMATIONS;

    this._lockerDebug = null;
    this._parts = null;
    this._caseForOutline = null;

    this._allMeshes = [];
    this._casesState = [];
    this._casesPreviousState = [];
    this._caseMoveTween = [];
    this._caseStartPositions = [];

    this._init();
  }

  pushAllCases() {
    const isAllCasesClosed = this._casesState.every(state => state === LOCKER_CASE_STATE.Closed);

    if (isAllCasesClosed) {
      if (this._currentAnimationType === LOCKER_CASES_RANDOM_ANIMATIONS) {
        const animationTypes = Object.values(LOCKER_CASES_ANIMATION_TYPE);
        const animationType = animationTypes[Math.floor(Math.random() * animationTypes.length)];

        this._showCasesAnimation(animationType);
      } else {
        this._showCasesAnimation(this._currentAnimationType);
      }
    } else {
      for (let i = 0; i < LOCKER_CONFIG.casesCount; i += 1) {
        this._moveCase(i, LOCKER_CASE_MOVE_DIRECTION.In);
      }
    }
  }

  pushCase(instanceId) {
    if (this._casesState[instanceId] === LOCKER_CASE_STATE.Moving) {
      this._stopCaseMoveTween(instanceId);

      if (this._casesPreviousState[instanceId] === LOCKER_CASE_STATE.Opened) {
        this._casesPreviousState[instanceId] = LOCKER_CASE_STATE.Closed;
        this._moveCase(instanceId, LOCKER_CASE_MOVE_DIRECTION.Out);
      } else {
        this._casesPreviousState[instanceId] = LOCKER_CASE_STATE.Opened;
        this._moveCase(instanceId, LOCKER_CASE_MOVE_DIRECTION.In);
      }

      return;
    }

    if (this._casesState[instanceId] === LOCKER_CASE_STATE.Opened) {
      this._moveCase(instanceId, LOCKER_CASE_MOVE_DIRECTION.In);
    } else {
      this._moveCase(instanceId, LOCKER_CASE_MOVE_DIRECTION.Out);
    }
  }

  getObjectType() {
    return this._objectType;
  }

  getAllMeshes() {
    return this._allMeshes;
  }

  getBodyMesh() {
    return [this._parts[LOCKER_PART_TYPE.BODY]];
  }

  getCaseMesh(instanceId) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    const casePart = this._parts[LOCKER_PART_TYPE.CASE];

    casePart.getMatrixAt(instanceId, matrix);
    position.setFromMatrixPosition(matrix);

    this._caseForOutline.position.copy(position);

    return [this._caseForOutline];
  }

  _moveCase(instanceId, direction, delay = 0) {
    this._stopCaseMoveTween(instanceId);
    const endState = direction === LOCKER_CASE_MOVE_DIRECTION.Out ? LOCKER_CASE_STATE.Opened : LOCKER_CASE_STATE.Closed;

    if (this._casesState[instanceId] === endState) {
      return;
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    const casePart = this._parts[LOCKER_PART_TYPE.CASE];

    casePart.getMatrixAt(instanceId, matrix);
    position.setFromMatrixPosition(matrix);

    const startPositionZ = this._caseStartPositions[instanceId].clone().z;
    const endPositionZ = direction === LOCKER_CASE_MOVE_DIRECTION.Out ? startPositionZ + LOCKER_CONFIG.caseMoveDistance : startPositionZ;
    const time = Math.abs(position.z - endPositionZ) / LOCKER_CONFIG.caseMoveSpeed * 1000;

    this._caseMoveTween[instanceId] = new TWEEN.Tween(position)
      .to({ z: endPositionZ }, time)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .delay(delay)
      .start();

    this._caseMoveTween[instanceId].onStart(() => {
      this._casesState[instanceId] = LOCKER_CASE_STATE.Moving;
    });

    this._caseMoveTween[instanceId].onUpdate(() => {
      matrix.setPosition(position);

      casePart.setMatrixAt(instanceId, matrix);
      casePart.instanceMatrix.needsUpdate = true;
    });

    this._caseMoveTween[instanceId].onComplete(() => {
      this._casesState[instanceId] = direction === LOCKER_CASE_MOVE_DIRECTION.Out ? LOCKER_CASE_STATE.Opened : LOCKER_CASE_STATE.Closed;
      this._casesPreviousState[instanceId] = this._casesState[instanceId];
    });
  }

  _stopCaseMoveTween(instanceId) {
    if (this._caseMoveTween[instanceId]) {
      this._caseMoveTween[instanceId].stop();
    }
  }

  _showCasesAnimation(animationType) {
    const casesSequence = LOCKER_CASES_ANIMATION_SEQUENCE[animationType];

    for (let j = 0; j < casesSequence.length; j += 1) {
      casesSequence[j].forEach((i) => {
        const delay = j * (1 / LOCKER_CONFIG.caseMoveSpeed) * LOCKER_CONFIG.allCasesAnimationDelayCoefficient;
        this._moveCase(i, LOCKER_CASE_MOVE_DIRECTION.Out, delay);
      });
    }
  }

  _init() {
    const casePart = this._caseForOutline = this._lockerGroup.children.find(child => child.name === 'case01');
    const caseGeometry = casePart.geometry.clone();
    const caseStartPosition = casePart.position.clone();

    this._caseForOutline.material = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0,
      color: 0x00ff00
    });

    const scale = 1.005;
    casePart.scale.set(scale, scale, scale);

    this.add(this._caseForOutline);

    this._removeExtraParts(this._lockerGroup);

    const parts = this._parts = this._getParts(this._lockerGroup);
    this._addMaterials(parts);

    const body = parts[LOCKER_PART_NAME.BODY];
    this.add(body);

    this._initCases(caseGeometry, caseStartPosition);

    this._initDebug();
  }

  _initCases(caseGeometry, caseStartPosition) {
    const material = new THREE.MeshLambertMaterial();

    const casePart = new THREE.InstancedMesh(caseGeometry, material, LOCKER_CONFIG.casesCount);
    this.add(casePart);

    casePart.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const matrix = new THREE.Matrix4();

    for (let i = 0; i < LOCKER_CONFIG.casesCount; i += 1) {
      matrix.setPosition(new THREE.Vector3(caseStartPosition.x, caseStartPosition.y - i * 0.515, caseStartPosition.z));
      casePart.setMatrixAt(i, matrix);
      casePart.setColorAt(i, new THREE.Color(`hsl(${Math.random() * 360}, 80%, 50%)`));

      this._casesState.push(LOCKER_CASE_STATE.Closed);
      this._casesPreviousState.push(LOCKER_CASE_STATE.Closed);
      this._caseMoveTween.push(null);

      this._caseStartPositions.push(new THREE.Vector3().setFromMatrixPosition(matrix));
    }

    casePart.instanceMatrix.needsUpdate = true;

    casePart.userData['objectType'] = this._objectType;
    this._parts[LOCKER_PART_TYPE.CASE] = casePart;
    this._allMeshes.push(casePart);
  }

  _getParts(lockerGroup) {
    const lockerParts = {};

    for (const partName in LOCKER_PART_NAME) {
      const part = lockerGroup.children.find(child => child.name === LOCKER_PART_NAME[partName]);
      lockerParts[LOCKER_PART_NAME[partName]] = part;

      part.userData['objectType'] = this._objectType;
      this._allMeshes.push(part);
    }

    return lockerParts;
  }

  _removeExtraParts(lockerGroup) {
    for (const partName in LOCKER_PART_NAME_TO_DELETE) {
      const part = lockerGroup.children.find(child => child.name === LOCKER_PART_NAME_TO_DELETE[partName]);
      if (part) {
        part.geometry.dispose();
        lockerGroup.remove(part);
      }
    }
  }

  _addMaterials(parts) {
    for (const partName in parts) {
      const part = parts[partName];
      const material = new THREE.MeshLambertMaterial({
        color: Math.random() * 0xffffff,
      });

      part.material = material;
    }
  }

  _initDebug() {
    const lockerDebug = this._lockerDebug = new LockerDebug(this._currentAnimationType);

    lockerDebug.events.on('pushCase', (msg, instanceId) => this.pushCase(instanceId));
    lockerDebug.events.on('pushAllCases', () => this.pushAllCases());
    lockerDebug.events.on('changeAllCasesAnimation', (msg, allCasesAnimation) => this._currentAnimationType = allCasesAnimation);
  }
}
