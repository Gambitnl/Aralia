/** Captured inn33 entry regression. An integral terrain-cell translation
 * keeps the original bilinear heights and fitted structural geometry in a small
 * fixture. Actual play opened the leaf but stopped outside its raised foundation.
 * This proves a walk through real support, rather than widening the step limit. */
import {describe,expect,it} from 'vitest';
import {addBuildingEntryApproaches} from '../buildingEntryApproach';
import {groundSurfaceY,type GroundWorld} from '../groundChunkLoader';
import {resolveGroundWalk} from '../../../../components/World3D/groundBuildingMotion';
import {siteDoorKey} from '../sitePartTransform';
import {metersToHeight} from '../../../world3d/config';

const encoded=[
  0.19347232486279203, 0.19389503807893788, 0.1948350323823233, 0.1959507265555004, 0.19688348615836498, 0.1973798382905264, 0.1970276634044587, 0.2142065633138021, 0.2091861979166667, 0.20412242431640626, 0.2005236775716146, 0.1998880574544271, 0.20250081787109375, 0.2068499064127604,
  0.22923251953125, 0.23059212646484376, 0.23215740559895834, 0.23383843994140627, 0.23509211018880208, 0.23552102457682292, 0.24071369008049887, 0.23891095774000404, 0.23636718536044676, 0.23377897124911867, 0.21674749348958333, 0.21534706217447916, 0.21567934163411462, 0.2169133748372396,
  0.24345645751953127, 0.24517469889322918, 0.24654515787760414, 0.24786807454427084, 0.24782514231031658, 0.2478367695075822, 0.2471835794034155, 0.24693833393703937, 0.24693833393703937, 0.24001114898349363, 0.23793375640536862, 0.22692413330078126, 0.2256559936523438, 0.22475113932291668,
  0.24978216959635416, 0.2515960123697917, 0.25000252878492596, 0.25071618031487386, 0.2511706745368791, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24037391753818113, 0.23143393554687502, 0.22970484212239584, 0.2283100952148438,
  0.24714301340406658, 0.24803572377190514, 0.24909302357659263, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.23881432281161868, 0.22806618245442709, 0.2263350219726563, 0.22505034586588543,
  0.24272442006096762, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.23451174305901448, 0.21938970947265626, 0.2179334676106771, 0.21705083414713544,
  0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.23725033558831135, 0.23268963205641033, 0.22933970733310302, 0.20931952311197916, 0.20845394287109376, 0.20823948567708336,
  0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24077802723870198, 0.23760018503492591, 0.23297385243401447, 0.20967815755208336, 0.20308631184895837, 0.20127556966145835, 0.20119340413411463, 0.2017509928385417,
  0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.24693833393703937, 0.2354380431078426, 0.23719840077385823, 0.23695655507073324, 0.22131258951822919, 0.2128795125325521, 0.204446435546875, 0.1987826985677083, 0.19789024658203128, 0.19871035156250003, 0.20007667643229168,
  0.24693833393703937, 0.24693833393703937, 0.22779354847893635, 0.22951489043857176, 0.2312659463467749, 0.21813862304687504, 0.21815412597656253, 0.21386136474609374, 0.20722714436848957, 0.20068490804036457, 0.19666809895833334, 0.19698074137369792, 0.19910102539062502, 0.20177218017578125,
  0.24693833393703937, 0.22664090565667072, 0.22654762969638426, 0.20638998616536458, 0.206914501953125, 0.207844677734375, 0.20835989176432296, 0.20579053955078128, 0.20146367187499997, 0.1973300740559896, 0.1953394978841146, 0.19702466634114588, 0.20069834391276045, 0.20499627278645835,
  0.22697008453036865, 0.22643678374911863, 0.20336691487630207, 0.20038311767578126, 0.19792952067057293, 0.19725514322916668, 0.19828970540364585, 0.1974706339518229, 0.1954826416015625, 0.19379178873697916, 0.1938641357421875, 0.196955419921875, 0.20221453043619791, 0.20816558837890628
];
const building={
  "id": "wf-plot-675-33",
  "xM": 10.04193038874638,
  "zM": 7.564199659283474,
  "cornersM": [
    {
      "x": 16.164188413359227,
      "z": 7.885216933956713
    },
    {
      "x": 6.877617252518974,
      "z": 12.815125081029123
    },
    {
      "x": 3.91967236420453,
      "z": 7.243182384468241
    },
    {
      "x": 13.20624352511578,
      "z": 2.313274237395831
    }
  ],
  "heightM": 6.096,
  "role": "market",
  "wallWidthM": 9.144,
  "wallDepthM": 6.096,
  "parts": [
    {
      "x": -3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -2.286,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 2.286,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": -0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": -3.048
    },
    {
      "x": 0,
      "z": -3.2766,
      "w": 10.0584,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": -3.048
    },
    {
      "x": 0,
      "z": 3.2766,
      "w": 10.0584,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": -3.048
    },
    {
      "x": -4.8006,
      "z": 0,
      "w": 0.45720000000000005,
      "d": 6.096,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": -3.048
    },
    {
      "x": 4.8006,
      "z": 0,
      "w": 0.45720000000000005,
      "d": 6.096,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "renderRole": "tactical-only",
      "baseY": -3.048
    },
    {
      "x": 1.7318181818181824,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.2770909090909091,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 1.842654545454546,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.5541818181818182,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 1.9534909090909094,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.8312727272727273,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.0643272727272732,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.1083636363636364,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.1751636363636364,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.3854545454545453,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.2860000000000014,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.6625454545454545,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.3968363636363637,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.9396363636363636,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.507672727272728,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.216727272727273,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.618509090909092,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.493818181818182,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.7293454545454554,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.7709090909090905,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": 2.840181818181819,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 3.048,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true,
      "baseY": -3.048
    },
    {
      "x": -3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -2.286,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": 3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor"
    },
    {
      "x": -3.8862,
      "z": -3.2766,
      "w": 2.286,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": -2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": -2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 1.0668,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 1.9812
    },
    {
      "x": -2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 0.9144000000000001,
      "lightRole": "window"
    },
    {
      "x": -0.1524,
      "z": -3.2766,
      "w": 3.3528000000000002,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 4.038600000000001,
      "z": -3.2766,
      "w": 1.9812,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": -2.3622,
      "z": 3.2766,
      "w": 5.3340000000000005,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 1.0668,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 1.9812
    },
    {
      "x": 0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 0.9144000000000001,
      "lightRole": "window"
    },
    {
      "x": 3.1242,
      "z": 3.2766,
      "w": 3.81,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": -4.8006,
      "z": 0,
      "w": 0.45720000000000005,
      "d": 6.096,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 4.8006,
      "z": 0,
      "w": 0.45720000000000005,
      "d": 6.096,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "renderRole": "tactical-only"
    },
    {
      "x": 1.6764000000000001,
      "z": -3.2766,
      "w": 0.3048,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 2.8956,
      "z": -3.2766,
      "w": 0.3048,
      "d": 0.45720000000000005,
      "h": 3.048,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard"
    },
    {
      "x": 2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#6b4a30",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 2.1336
    },
    {
      "x": 2.840181818181819,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.2770909090909091,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.7293454545454554,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.5541818181818182,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.618509090909092,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 0.8312727272727273,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.507672727272728,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.1083636363636364,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.3968363636363637,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.3854545454545453,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.2860000000000014,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.6625454545454545,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.1751636363636364,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 1.9396363636363636,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 2.0643272727272732,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.216727272727273,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 1.9534909090909094,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.493818181818182,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 1.842654545454546,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 2.7709090909090905,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": 1.7318181818181824,
      "z": 0.762,
      "w": 0.11083636363636365,
      "d": 1.2192,
      "h": 3.048,
      "colorHex": "#7a5a36",
      "walkSurface": "tread",
      "stairSolid": true
    },
    {
      "x": -3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 3.81,
      "z": -2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 3.81,
      "z": -0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 3.81,
      "z": 0.762,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": 3.81,
      "z": 2.286,
      "w": 1.524,
      "d": 1.524,
      "h": 0.12192000000000001,
      "colorHex": "#9a8a72",
      "walkSurface": "floor",
      "baseY": 3.048
    },
    {
      "x": -2.3622,
      "z": -3.2766,
      "w": 5.3340000000000005,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 0.762,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": 0.762,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": 1.524,
      "z": -3.2766,
      "w": 0.6096,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": 2.286,
      "z": -3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": 3.8862,
      "z": -3.2766,
      "w": 2.286,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -3.8862,
      "z": 3.2766,
      "w": 2.286,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": -2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": -1.524,
      "z": 3.2766,
      "w": 0.6096,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": -0.762,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": 0.762,
      "z": 3.2766,
      "w": 2.1336,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.45720000000000005,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": 2.286,
      "z": 3.2766,
      "w": 0.9144000000000001,
      "d": 0.18288000000000004,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": 3.8862,
      "z": 3.2766,
      "w": 2.286,
      "d": 0.45720000000000005,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -4.8006,
      "z": -2.1336,
      "w": 0.45720000000000005,
      "d": 1.8288000000000002,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -4.8006,
      "z": -0.762,
      "w": 0.45720000000000005,
      "d": 0.9144000000000001,
      "h": 0.9144000000000001,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": -4.8006,
      "z": -0.762,
      "w": 0.45720000000000005,
      "d": 0.9144000000000001,
      "h": 0.9448799999999999,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 5.0292
    },
    {
      "x": -4.8006,
      "z": -0.762,
      "w": 0.18288000000000004,
      "d": 0.9144000000000001,
      "h": 1.0668,
      "colorHex": "#b7d9df",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.9624,
      "lightRole": "window"
    },
    {
      "x": -4.8006,
      "z": 1.3716000000000002,
      "w": 0.45720000000000005,
      "d": 3.3528000000000002,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "baseY": 3.048
    },
    {
      "x": 4.8006,
      "z": 0,
      "w": 0.45720000000000005,
      "d": 6.096,
      "h": 2.9260800000000002,
      "colorHex": "#b89a72",
      "tag": "exterior",
      "wallMaterial": "weatherboard",
      "renderRole": "tactical-only",
      "baseY": 3.048
    },
    {
      "x": 2.286,
      "z": -3.048,
      "w": 0.9144000000000001,
      "d": 0.06,
      "h": 2.1336,
      "colorHex": "#4a3220",
      "door": {
        "id": "0:4:x:2.2860:-3.0480",
        "level": 0,
        "index": 4,
        "axis": "x",
        "swingX": 0,
        "swingZ": 1
      }
    }
  ]
} as GroundWorld['buildings'][number];

function fixture(){return {cols:14,rows:12,heights:Array.from(encoded),buildings:[structuredClone(building)]} as GroundWorld;}
// These are the real inspected door center and outward normal in the translated
// source frame. The starting feet are on the public street, before any new tread.
const door={x:9.451980230267907,z:11.328247853703147};
const normal={x:0.4688894461599061,z:0.8832568637037906};
function walk(ground:GroundWorld,doors:ReadonlySet<string>,entry=door,outward=normal){
  const start={xM:entry.x+outward.x*3.5,zM:entry.z+outward.z*3.5};
  let p={...start,yM:groundSurfaceY(ground,start.xM,start.zM)};
  const target={xM:entry.x-outward.x,zM:entry.z-outward.z};
  for(let i=0;i<400;i++){
    const dx=target.xM-p.xM,dz=target.zM-p.zM,d=Math.hypot(dx,dz);
    if(d<.06)return {reached:true,feet:p};
    p=resolveGroundWalk(ground,p,{xM:p.xM+dx/d*.02,zM:p.zM+dz/d*.02},doors,undefined,1.8451851610227348);
  }
  return {reached:false,feet:p};
}
function connect(ground:GroundWorld){return {...ground,buildings:addBuildingEntryApproaches(ground.buildings,(x,z)=>groundSurfaceY(ground,x,z))};}

describe('real street-to-entry support',()=>{
  it('connects the actual raised open inn entry without moving its foundation or the player',()=>{
    const ground=fixture(),leaf=ground.buildings[0].parts.find(p=>p.door)!;
    const doors=new Set([siteDoorKey(building.id,leaf)]);
    expect(walk(ground,doors).reached).toBe(false);
    expect(connect(ground).buildings[0].parts.filter(p=>p.tag==='entry-approach')).toHaveLength(7);
    expect(walk(connect(ground),doors).reached).toBe(true);
  });
  it('retains the closed leaf as a physical obstruction',()=>{
    expect(walk(connect(fixture()),new Set()).reached).toBe(false);
  });
  it('retains every source part and the terrain samples',()=>{
    const ground=fixture(),before=JSON.stringify(ground),result=connect(ground);
    expect(JSON.stringify(ground)).toBe(before);
    expect(result.heights).toBe(ground.heights);
    expect(result.buildings[0].parts.slice(0,ground.buildings[0].parts.length)).toEqual(ground.buildings[0].parts);
    expect(result.buildings[0].cornersM).toBe(ground.buildings[0].cornersM);
  });
  it('does not build a second approach when a world is derived again',()=>{
    const ground=connect(fixture());
    expect(connect(ground).buildings[0]).toBe(ground.buildings[0]);
  });
  it('does not add a stoop on support that the world refuses',()=>{
    const ground=fixture();
    expect(addBuildingEntryApproaches(ground.buildings,(x,z)=>groundSurfaceY(ground,x,z),()=>false)[0]).toBe(ground.buildings[0]);
  });
  it('retains a neighboring building instead of constructing a stoop through it',()=>{
    const ground=fixture(),x=door.x+normal.x,z=door.z+normal.z;
    ground.buildings.push({...ground.buildings[0],id:'neighbor',xM:x,zM:z,parts:[],
      cornersM:[{x:x-1,z:z-1},{x:x+1,z:z-1},{x:x+1,z:z+1},{x:x-1,z:z+1}]});
    expect(connect(ground).buildings[0]).toBe(ground.buildings[0]);
  });
  it('leaves a level usable frontage unchanged',()=>{
    const ground=fixture();
    expect(addBuildingEntryApproaches(ground.buildings,()=>4.4448900108667075)[0]).toBe(ground.buildings[0]);
  });
  it.each(['side entry','mirrored front entry'] as const)('walks the real support with a %s',kind=>{
    const mirrored=kind==='mirrored front entry';
    const b={id:'source-entry',xM:4.572,zM:4.572,heightM:3.048,role:'house',wallWidthM:3.048,wallDepthM:3.048,
      cornersM:mirrored?[{x:3.048,z:3.048},{x:3.048,z:6.096},{x:6.096,z:6.096},{x:6.096,z:3.048}]
        :[{x:3.048,z:3.048},{x:6.096,z:3.048},{x:6.096,z:6.096},{x:3.048,z:6.096}],
      parts:[{x:0,z:0,w:3.048,d:3.048,h:.12192,colorHex:'#888',walkSurface:'floor'},
        mirrored?{x:0,z:1.7526,w:3.5052,d:.4572,h:3.048,baseY:-3.048,colorHex:'#888',tag:'exterior'}
          :{x:1.7526,z:0,w:.4572,d:3.5052,h:3.048,baseY:-3.048,colorHex:'#888',tag:'exterior'},
        mirrored?{x:0,z:1.524,w:.9144,d:.06,h:2.1336,colorHex:'#4a3220',door:{id:'entry',level:0,index:0,axis:'x',swingX:0,swingZ:-1}}
          :{x:1.524,z:0,w:.06,d:.9144,h:2.1336,colorHex:'#4a3220',door:{id:'entry',level:0,index:0,axis:'y',swingX:-1,swingZ:0}}]} as GroundWorld['buildings'][number];
    // This lower street exercises orientation without assuming every grade
    // needs a new connection. The captured inn above owns the refusal regression.
    const ground={cols:10,rows:10,heights:Array.from({length:100},(_,i)=>metersToHeight(Math.max(.45,1-Math.max(0,(i%10)*1.524-6.096)*.45))),buildings:[b]} as GroundWorld;
    const opens=new Set([siteDoorKey(b.id,b.parts[2])]),target={x:6.096,z:4.572},outward={x:1,z:0};
    expect(walk(connect(ground),opens,target,outward).reached).toBe(true);
    expect(walk(connect(ground),new Set(),target,outward).reached).toBe(false);
  });
});


describe('entry treads meeting a downhill street',()=>{
  // Compact slope exercises the soil-intersection cause observed at native121.
  // The retained native packet and actual gameplay provide site-specific proof;
  // this fixture checks the construction rule without copying an entire town.
  const b={id:'downhill-frontage',xM:6.096,zM:6.096,heightM:3.048,role:'house',wallWidthM:3.048,wallDepthM:3.048,
    cornersM:[{x:4.572,z:4.572},{x:7.62,z:4.572},{x:7.62,z:7.62},{x:4.572,z:7.62}],
    parts:[{x:0,z:0,w:3.048,d:3.048,h:.12192,colorHex:'#888',walkSurface:'floor'},
      {x:0,z:-1.7526,w:3.5052,d:.4572,h:3.048,baseY:-3.048,colorHex:'#888',tag:'exterior'},
      {x:0,z:-1.524,w:.9144,d:.06,h:2.1336,colorHex:'#4a3220',door:{id:'entry',level:0,index:0,axis:'x',swingX:0,swingZ:1}}]} as GroundWorld['buildings'][number];
  function slope(){return {cols:12,rows:12,heights:Array.from({length:144},(_,i)=>
    metersToHeight(2-Math.max(0,6.096-Math.floor(i/12)*1.524)*.22+((i%12)*1.524-6.096)*.04)),
    buildings:[structuredClone(b)]} as GroundWorld;}
  it('walks exposed treads into the floor while retaining the existing grade and closed-door guard',()=>{
    const ground=slope(),entry={x:6.096,z:4.572},normal={x:0,z:-1},opens=new Set([siteDoorKey(b.id,b.parts[2])]);
    expect(walk(ground,opens,entry,normal).reached).toBe(false);
    const next=connect(ground);
    expect(walk(next,opens,entry,normal).reached).toBe(true);
    expect(walk(next,new Set(),entry,normal).reached).toBe(false);
    expect(next.heights).toBe(ground.heights);
    expect(next.buildings[0].parts.slice(0,b.parts.length)).toEqual(ground.buildings[0].parts);
  });
  it('keeps a clear landing and omits treads completely buried by the unchanged hillside',()=>{
    const ground=slope(),next=connect(ground),parts=next.buildings[0].parts.filter(p=>p.tag==='entry-approach');
    expect(parts.some(p=>p.walkSurface==='landing')).toBe(true);
    expect(parts.some(p=>p.walkSurface==='tread')).toBe(true);
    for(const p of parts){
      const points=[[-1,-1],[-1,1],[1,-1],[1,1],[0,0]].map(([x,z])=>
        groundSurfaceY(ground,b.xM+p.x+x*p.w/2,b.zM+p.z+z*p.d/2));
      const top=groundSurfaceY(ground,b.xM,b.zM)+(p.baseY??0)+p.h;
      expect(Math.min(...points)).toBeLessThan(top-.005);
      if(p.walkSurface==='landing')expect(Math.max(...points)).toBeLessThan(top-.005);
    }
  });
});
