import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';

console.info("Loading android-remote-card");

class AndroidRemoteCard extends HTMLElement {
  constructor() {
    super();    
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._keycodes = new KeyCodes().getMapping();
    this._consumercodes = new ConsumerCodes().getMapping();

    this._hass = null;
    this._uiBuilt = false;
    this.card = null;

    // Configs
    this.config = null;
    this.loglevel = 'warn';
    this.logpushback = false;
    this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    this.eventManager = new EventManager(this.logger);
    this.resourceManager = new ResourceManager(this.logger, this.eventManager, import.meta.url);
    this.layout = 'classic';
    this.layoutUrl = `${Globals.DIR_LAYOUTS}/remote/${this.layout}.json`;
    this.keyboardConfig = {};
    this.mouseConfig = {};
    this.activitiesConfig = {};
    this.autoScroll = true;

    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};

    this.cellContents = { 
      "remote-button-power": {
        code: "CON_POWER",
        html: 
        `<svg id="power-icon" viewBox="0 0 64 68" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
          <!-- Left arc -->20
          <path d="M 6 34 A 26 26 0 0 1 24 8" stroke-width="4" />
          <!-- Right arc -->
          <path d="M 40 8 A 26 26 0 0 1 58 34" stroke-width="4" />
          <!-- Bottom arc -->
          <path d="M 58 34 A 26 26 0 0 1 6 34" stroke-width="4" />
          <!-- Vertical bar -->
          <line x1="32" y1="4" x2="32" y2="32" stroke-width="6" />
        </svg>`
      },
      "remote-button-power-android": {
        code: "CON_POWER",
        html: 
        `<svg id="android-icon" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
           <defs>
             <!-- Mask to subtract eyes -->
             <mask id="cutoutMask">
               <!-- Start fully visible -->
               <rect x="0" y="0" width="100" height="120" fill="white" />

               <!-- Eyes (subtracted via black circles) -->
               <circle cx="37" cy="34" r="2.5" fill="black" />
               <circle cx="63" cy="34" r="2.5" fill="black" />
             </mask>
           </defs>

           <!-- Head -->
           <path d="M25,45 A25,25 0 0 1 75,45 Z" fill="#bfbfbf" mask="url(#cutoutMask)" />

           <!-- Antennae -->
           <line x1="37" y1="23.646" x2="31" y2="13.646" stroke="#bfbfbf" stroke-width="3" />
           <line x1="63" y1="23.646" x2="69" y2="13.646" stroke="#bfbfbf" stroke-width="3" />

           <!-- Torso -->
           <path d="M25,47.5 H75 V81.45 A5,5 0 0 1 70,86.45 H30 A5,5 0 0 1 25,81.45 Z" fill="#bfbfbf" />

           <!-- Arms -->
           <rect x="13" y="47.5" width="10" height="28.75" rx="5" fill="#bfbfbf" />
           <rect x="77" y="47.5" width="10" height="28.75" rx="5" fill="#bfbfbf" />

           <!-- Legs (top moved down by 5 units, height reduced accordingly) -->
           <path d="M36,82.5 h10 v14.345 a5,5 0 0 1 -10,0 z" fill="#bfbfbf" />
           <path d="M54,82.5 h10 v14.345 a5,5 0 0 1 -10,0 z" fill="#bfbfbf" />
         </svg>`
      },
      "remote-button-power-shield-1": {
        code: "CON_POWER",
        html: 
        `<svg id="shield-tv-icon" viewBox="0 0 92.898956 68.384179" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(-0.06909526)">
            <path style="display:inline;fill:#bfbfbf;fill-opacity:1;stroke-width:0.458822" d="m 0.38796728,66.496777 v -1.887412 l 4.86706662,-2.29e-4 c 4.7726691,-2.25e-4 4.8710331,-0.0028 5.0716461,-0.12496 0.35026,-0.21355 0.382568,-0.38162 0.38246,-1.989609 -1.05e-4,-1.582625 -0.02797,-1.724612 -0.39063,-1.990771 C 10.14774,60.378465 10.06515,60.375148 6.3630544,60.344893 2.5875707,60.314015 2.5814886,60.313789 2.2275312,60.170826 1.1932596,59.753106 0.43882564,58.919405 0.17358127,57.901065 0.03579158,57.372053 0.03361832,52.01594 0.17101241,51.488576 0.39864039,50.61465 1.0433675,49.781554 1.7995925,49.38417 2.6138821,48.956273 2.3409054,48.972956 8.5282124,48.972956 h 5.5802766 v 1.852637 1.852637 l -4.7434561,0.01693 c -4.4581426,0.01592 -4.7533604,0.02368 -4.9080934,0.128708 -0.3167665,0.215063 -0.3607197,0.417349 -0.360467,1.658978 2.066e-4,1.015028 0.012876,1.154762 0.1206575,1.33154 0.2373804,0.389315 0.063286,0.371494 4.0637769,0.415931 3.0607751,0.034 3.7128231,0.05654 3.9863571,0.137734 1.149145,0.341139 2.071722,1.278844 2.364633,2.403401 0.138244,0.530759 0.140454,6.501275 0.0026,7.03053 -0.28766,1.104396 -1.161133,2.038281 -2.252063,2.407817 L 11.97625,68.34739 6.1821245,68.36578 0.38799941,68.38418 Z M 17.569481,58.677027 v -9.704071 h 2.039532 2.039532 v 3.924554 3.924554 h 4.048162 4.048163 V 52.89751 48.972956 h 2.00863 2.00863 v 9.703228 9.703227 H 31.7535 29.74487 v -3.924554 -3.924554 h -4.047702 -4.047701 l -0.01592,3.909106 -0.01591,3.909102 -2.024081,0.01628 -2.024081,0.01628 z m 19.530064,0 v -9.704071 h 2.039726 2.039724 l -0.01566,9.687775 -0.01564,9.68778 -2.02408,0.01628 -2.024082,0.01628 z m 7.292873,-9.17e-4 v -9.703246 h 6.829344 6.829342 v 1.853739 1.853743 l -4.805262,0.01582 -4.805261,0.01584 v 2.039534 2.039528 l 3.8782,0.01592 3.878204,0.01592 v 1.853656 1.853656 h -3.893653 -3.893653 v 2.039533 2.039534 h 4.82071 4.820715 v 1.885022 1.88502 h -6.829342 -6.829344 z m 16.934297,0 v -9.703246 h 2.008631 2.008625 v 7.818207 7.818202 h 4.171773 4.171772 v 1.885026 1.885021 h -6.180397 -6.180404 z m 15.430396,9.662026 c -0.02271,-0.02267 -0.04121,-4.390102 -0.04121,-9.705421 v -9.664232 l 5.546915,0.01816 5.546905,0.01817 0.556241,0.171878 c 1.112955,0.343904 1.86335,0.774132 2.634061,1.510191 1.119325,1.069012 1.746138,2.356488 1.906086,3.915125 0.08087,0.788177 0.08323,7.367089 0.0031,8.122213 -0.231722,2.178419 -1.5052,4.02639 -3.427922,4.974333 -0.713589,0.351807 -1.313511,0.527719 -2.104032,0.61694 -0.615746,0.06949 -10.551944,0.09064 -10.619988,0.02257 z m 10.073016,-3.815052 c 0.76026,-0.202432 1.418834,-0.762102 1.770604,-1.504718 l 0.197865,-0.417701 0.01726,-3.799251 c 0.01664,-3.662847 0.01284,-3.814023 -0.107666,-4.210662 -0.235133,-0.774126 -0.836844,-1.399026 -1.676584,-1.741211 -0.325938,-0.132815 -0.408902,-0.136757 -3.285514,-0.156134 l -2.951141,-0.01986 v 5.967881 5.967883 l 2.858436,-9.19e-4 c 2.223649,-4.57e-4 2.92911,-0.01955 3.176707,-0.08549 z"/>
            <path d="m 82.2115,102.414 c 0,0 22.504,-33.203 67.437,-36.637 V 53.73 c -49.769,3.997 -92.8667,46.149 -92.8667,46.149 0,0 24.4097,70.566 92.8667,77.027 v -12.804 c -50.238,-6.321 -67.437,-61.688 -67.437,-61.688 z m 67.437,36.223 v 11.726 c -37.968,-6.769 -48.507,-46.238 -48.507,-46.238 0,0 18.23,-20.195 48.507,-23.469 v 12.867 c -0.023,0 -0.039,-0.007 -0.058,-0.007 -15.891,-1.907 -28.305,12.937 -28.305,12.937 0,0 6.957,24.992 28.363,32.184 m 0,-107.125 V 53.73 c 1.461,-0.113 2.922,-0.207 4.391,-0.257 56.582,-1.907 93.449,46.406 93.449,46.406 0,0 -42.343,51.488 -86.457,51.488 -4.043,0 -7.828,-0.375 -11.383,-1.004 v 13.739 c 3.04,0.386 6.192,0.613 9.481,0.613 41.051,0 70.738,-20.965 99.484,-45.778 4.766,3.817 24.278,13.102 28.289,17.168 -27.332,22.883 -91.031,41.329 -127.144,41.329 -3.481,0 -6.824,-0.211 -10.11,-0.528 v 19.305 h 156.032 V 31.512 Z m 0,49.144 V 65.777 c 1.446,-0.101 2.903,-0.179 4.391,-0.226 40.688,-1.278 67.383,34.965 67.383,34.965 0,0 -28.832,40.043 -59.746,40.043 -4.449,0 -8.438,-0.715 -12.028,-1.922 V 93.523 c 15.84,1.914 19.028,8.911 28.551,24.786 l 21.18,-17.86 c 0,0 -15.461,-20.277 -41.524,-20.277 -2.835,0 -5.546,0.199 -8.207,0.484" style="display:block;fill:#74b71b;fill-opacity:1;fill-rule:nonzero;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:10" transform="matrix(0.26458333,0,0,0.26458333,-9.3101582,-8.33755)"/>
          </g>
        </svg>`
      },
      "remote-button-power-shield-2": {
        code: "CON_POWER",
        html: 
        `<svg id="shield-tv-icon-2" viewBox="0 0 202.4731 93.100845" xmlns="http://www.w3.org/2000/svg">
             <g>
                 <path style="display:inline;fill:#bfbfbf;fill-opacity:1" d="m 0.6949915,88.987236 v -4.11361 l 10.6077625,-5e-4 c 10.402025,-4.9e-4 10.616409,-0.006 11.053647,-0.27235 0.763389,-0.46543 0.833805,-0.83174 0.833571,-4.33635 -2.3e-4,-3.44933 -0.06095,-3.75879 -0.851379,-4.33888 -0.372194,-0.27316 -0.552199,-0.28039 -8.62091,-0.34633 -8.2286597,-0.0673 -8.2419163,-0.0678 -9.0133672,-0.37938 -2.2541928,-0.91042 -3.8984797,-2.72747 -4.47657866,-4.94694 -0.3003135,-1.15298 -0.3050504,-12.82662 -0.00567,-13.97601 0.49611476,-1.90472 1.90129626,-3.72045 3.54948736,-4.58655 1.7747418,-0.9326 1.1797904,-0.89624 14.6650175,-0.89624 h 12.162206 v 4.03782 4.03782 l -10.338358,0.0369 c -9.716515,0.0347 -10.3599412,0.0516 -10.6971829,0.28052 -0.690392,0.46873 -0.786188,0.90961 -0.785637,3.61574 4.51e-4,2.21225 0.02805,2.5168 0.262973,2.90209 0.517371,0.84851 0.137927,0.80967 8.8569959,0.90652 6.670955,0.0741 8.092092,0.12321 8.688261,0.30019 2.504558,0.74351 4.515313,2.78724 5.153711,5.23821 0.301306,1.15679 0.306122,14.16952 0.0057,15.32303 -0.626952,2.40703 -2.530686,4.44243 -4.908367,5.247832 l -0.885277,0.29988 -12.628288,0.0401 -12.6282873,0.0401 z M 38.142074,71.944106 v -21.15001 h 4.445157 4.445157 v 8.55356 8.55356 h 8.822963 8.822964 v -8.55356 -8.55356 h 4.377806 4.377806 v 21.14817 21.148172 h -4.377806 -4.377806 v -8.553562 -8.55356 h -8.821959 -8.821959 l -0.03468,8.51989 -0.03468,8.519882 -4.411482,0.0355 -4.411481,0.0355 z m 42.565747,0 v -21.15001 h 4.445577 4.445576 l -0.0341,21.11449 -0.03409,21.114502 -4.411481,0.0355 -4.411482,0.0355 z m 15.894804,-0.002 v -21.14821 h 14.884545 14.88454 v 4.04022 4.04023 l -10.47306,0.0345 -10.47306,0.0345 v 4.44516 4.44515 l 8.45253,0.0347 8.45254,0.0347 v 4.04004 4.04004 h -8.48621 -8.48621 v 4.44516 4.44516 h 10.50673 10.50674 v 4.1084 4.108402 H 111.48717 96.602625 Z m 36.908275,0 v -21.14821 h 4.37781 4.3778 v 17.03977 17.03976 h 9.09237 9.09237 v 4.10841 4.108402 H 146.98107 133.5109 Z m 33.63053,21.058372 c -0.0494,-0.0494 -0.0898,-9.568222 -0.0898,-21.152952 v -21.06318 l 12.08948,0.0396 12.08948,0.0396 1.21232,0.37461 c 2.42569,0.74954 4.06118,1.68722 5.74093,3.29146 2.43958,2.32991 3.8057,5.13596 4.15431,8.53301 0.17628,1.71783 0.18148,16.05656 0.006,17.70235 -0.50503,4.74786 -3.28057,8.77551 -7.47115,10.84155 -1.55525,0.766762 -2.86278,1.150162 -4.58573,1.344622 -1.34202,0.15147 -22.99795,0.19754 -23.14625,0.0492 z m 21.95411,-8.314902 c 1.657,-0.4412 3.09236,-1.661 3.85904,-3.27953 l 0.43124,-0.91038 0.0377,-8.28046 c 0.0363,-7.98317 0.0279,-8.31266 -0.23467,-9.17713 -0.51247,-1.68721 -1.82389,-3.04918 -3.65411,-3.79497 -0.71037,-0.28947 -0.89119,-0.29806 -7.16078,-0.34029 l -6.432,-0.0433 v 13.00699 13.00699 l 6.22995,-0.002 c 4.84645,-10e-4 6.38401,-0.0426 6.92364,-0.1863 z"/>
                 <path d="m 194.77952,26.529916 c 0,1.41988 -1.04288,2.37313 -2.27748,2.37313 v -0.009 c -1.26961,0.009 -2.29329,-0.94458 -2.29329,-2.36446 0,-1.41951 1.02368,-2.370122 2.29329,-2.370122 1.2346,0 2.27748,0.950612 2.27748,2.370122 z m 0.92386,0 c 0,-1.949051 -1.51366,-3.080441 -3.20134,-3.080441 -1.69896,0 -3.21301,1.13139 -3.21301,3.080441 0,1.94792 1.51405,3.08383 3.21301,3.08383 1.68768,0 3.20134,-1.13591 3.20134,-3.08383 m -3.73238,0.26062 h 0.34273 l 0.79469,1.39466 h 0.87227 l -0.8798,-1.45341 c 0.45458,-0.0324 0.82857,-0.24895 0.82857,-0.86097 0,-0.76041 -0.52388,-1.00484 -1.41236,-1.00484 h -1.28467 v 3.31922 h 0.73857 v -1.39466 m 0,-0.56193 v -0.7992 h 0.51372 c 0.27946,0 0.66024,0.0222 0.66024,0.36345 0,0.37098 -0.19698,0.43575 -0.52653,0.43575 H 191.971" style="display:block;fill:#bfbfbf;fill-opacity:1;fill-rule:nonzero;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:10"/>
                 <path d="m 174.14446,9.5507821 3.99149,10.9195669 h -8.10653 z m -4.2751,-4.251751 -9.19801,23.3053449 h 6.49533 l 1.45491,-4.117668 h 10.88567 l 1.37695,4.117668 h 7.05123 L 178.66852,5.2960181 Z M 151.40255,28.613416 h 6.58985 V 5.2918761 l -6.59099,-0.0016 z M 105.65433,5.2903681 100.15632,23.774505 94.889562,5.2918761 l -7.110356,-0.0016 7.522009,23.3230459 h 9.493655 l 7.58265,-23.3230459 z m 26.63737,5.0784489 h 2.83225 c 4.109,0 6.7661,1.8451 6.7661,6.632414 0,4.788446 -2.6571,6.633545 -6.7661,6.633545 H 132.2917 Z M 125.75683,5.2903681 V 28.613416 h 10.6838 c 5.69198,0 7.55026,-0.94609 9.55995,-3.06914 1.4195,-1.490313 2.33773,-4.760572 2.33773,-8.3359 0,-3.279297 -0.77699,-6.202305 -2.13173,-8.0236769 -2.44092,-3.257453 -5.95711,-3.894331 -11.20467,-3.894331 z M 63.333618,5.2579881 V 28.613426 h 6.645409 V 10.879524 l 5.149254,0.0016 c 1.704994,0 2.920371,0.424836 3.74142,1.302003 1.041376,1.109169 1.466588,2.899657 1.466588,6.174435 V 28.613506 H 86.77587 V 15.709459 c 0,-9.2096799 -5.87012,-10.4514209 -11.613692,-10.4514209 z m 51.817382,0.03238 0.003,23.3230479 h 6.58683 V 5.2903681 Z" style="display:block;fill:#bfbfbf;fill-opacity:1;fill-rule:nonzero;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:10"/>
                 <path d="m 9.3186241,14.957831 c 0,0 4.7475539,-7.0046649 14.2268389,-7.7291199 V 4.6872181 C 13.045952,5.5304431 3.9538511,14.423035 3.9538511,14.423035 c 0,0 5.149591,14.886951 19.5916119,16.249991 v -2.70119 C 12.947011,26.638326 9.3186241,14.957831 9.3186241,14.957831 Z m 14.2268389,7.641782 v 2.473773 c -8.009914,-1.428022 -10.233272,-9.754593 -10.233272,-9.754593 0,0 3.84589,-4.260436 10.233272,-4.951136 v 2.714485 c -0.0049,0 -0.0083,-0.0013 -0.01224,-0.0013 -3.352441,-0.40231 -5.97136,2.729251 -5.97136,2.729251 0,0 1.467682,5.272435 5.983596,6.789695 m 0,-22.59961 v 4.6872161 c 0.30822,-0.02383 0.616439,-0.04366 0.926347,-0.05421 11.936815,-0.402311 19.714457,9.7900319 19.714457,9.7900319 0,0 -8.932886,10.86216 -18.23939,10.86216 -0.85293,0 -1.651433,-0.0791 -2.401414,-0.21181 v 2.89844 c 0.641335,0.0814 1.306296,0.12933 2.000157,0.12933 8.660321,0 14.923235,-4.422878 20.987631,-9.65755 1.005457,0.805253 5.121804,2.76406 5.967985,3.621843 -5.766092,4.827507 -19.204343,8.718967 -26.822917,8.718967 -0.734369,0 -1.439623,-0.0445 -2.132856,-0.11139 v 4.07267 H 56.462734 V 0 Z m 0,10.367657 V 7.2288661 c 0.305056,-0.02129 0.612433,-0.03777 0.926347,-0.04768 8.583738,-0.269611 14.215445,7.3763859 14.215445,7.3763859 0,0 -6.082538,8.447668 -12.604305,8.447668 -0.938583,0 -1.780122,-0.150842 -2.537487,-0.405474 v -9.517472 c 3.341683,0.403788 4.01424,1.879909 6.02326,5.228976 l 4.468236,-3.767874 c 0,0 -3.261728,-4.277734 -8.760105,-4.277734 -0.598083,0 -1.170011,0.04198 -1.731388,0.1021" style="display:block;fill:#74b71b;fill-opacity:1;fill-rule:nonzero;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:10"/>
             </g>
         </svg>`
      },
      "remote-button-power-tv": {
        html: 
        `<svg id="tv-icon" viewBox="50 82 412 316" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
           <!-- Screen + body -->
           <rect x="64" y="96" width="384" height="256" rx="32" ry="32"></rect>
           <!-- Stand -->
           <line x1="160" y1="384" x2="352" y2="384"></line>
           <!-- Text centered on screen with stroke width 50% of global -->
           <g stroke-width="15">
             <text x="256" y="240" text-anchor="middle" dominant-baseline="middle" font-size="80" font-family="system-ui, sans-serif" fill="#bfbfbf">
               TV
             </text>
           </g>
         </svg>`
      },
      "remote-button-power-old-tv": {
        html: 
        `<svg id="old-tv-icon" viewBox="50 18 412 380" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
           <!-- Screen + body -->
           <rect x="64" y="96" width="384" height="256" rx="32" ry="32"></rect>
           <!-- Stand -->
           <line x1="160" y1="384" x2="352" y2="384"></line>
           <!-- Antenna -->
           <line x1="192" y1="96" x2="128" y2="32"></line>
           <line x1="320" y1="96" x2="384" y2="32"></line>
         </svg>`
      },
      "remote-button-power-device": {
        html: 
        `<svg id="device-icon" class="standard-grey" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <g>
            <path class="primary-path" d="M11 15H6L13 1V9H18L11 23V15Z" />
          </g>
        </svg>`
      },
      "remote-button-settings": {
        code: "KEY_COMPOSE", 
        html: 
        `<svg id="settings-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Top line -->
          <line x1="4" y1="6" x2="20" y2="6" />
          <!-- Middle line -->
          <line x1="4" y1="12" x2="20" y2="12" />
          <!-- Bottom line -->
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>`
      },
      "dpad": { 
        tag: "svg"
      },
      "remote-button-arrow-up": {
        code: "KEY_UP", 
        html: 
        `<svg id="arrow-up-icon" viewBox="4 4 16 16" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <polygon points="12,4 4,20 20,20" />
        </svg>`
      },
      "remote-button-arrow-right": {
        code: "KEY_RIGHT", 
        html: 
        `<svg id="arrow-right-icon" viewBox="6 4 14 16" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <polygon points="6,4 20,12 6,20" />
        </svg>`
      },
      "remote-button-arrow-down": {
        code: "KEY_DOWN", 
        html: 
        `<svg id="arrow-down-icon" viewBox="4 4 16 16" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <polygon points="4,4 20,4 12,20" />
        </svg>`
      },
      "remote-button-arrow-left": {
        code: "KEY_LEFT", 
        html: 
        `<svg id="arrow-left-icon" viewBox="4 4 14 16" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <polygon points="18,4 4,12 18,20" />
        </svg>`
      },
      "remote-button-center": {
        code: "KEY_ENTER"
      },
      "remote-button-return": {
        code: "CON_AC_BACK", 
        style: "side-button left", 
        html: 
        `<svg id="return-icon" viewBox="-14 0 80 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <!-- Top horizontal line -->
          <line x1="8" y1="17" x2="48" y2="17" />
          <!-- Bottom horizontal line -->
          <line x1="8" y1="47" x2="48" y2="47" />
          <!-- Vertically flipped arc from bottom right to top right -->
          <path d="M48 47 A15 15 0 0 0 48 17" />
          <!-- Left-pointing isosceles triangle with reduced width -->
          <path  fill="#bfbfbf" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M-12 17 L8 7 L8 27 Z" />
        </svg>`
      },
      "remote-button-home": {
        code: "CON_AC_HOME", 
        style: "side-button right", 
        html: 
        `<svg id="home-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <!-- Roof (triangle) -->
          <path d="M 12 32 L 32 12 L 52 32" />
          
          <!-- House base without top line -->
          <line x1="16" y1="32" x2="16" y2="52" /> <!-- Left side -->
          <line x1="48" y1="32" x2="48" y2="52" /> <!-- Right side -->
          <line x1="16" y1="52" x2="48" y2="52" /> <!-- Bottom side -->
        </svg>`
      },
      "ts-toggle-container": {
        tag: "div",
        style: "ts-toggle-container", 
        html: 
        `<div class="ts-toggle-indicator"></div>
        <div class="ts-toggle-option active">
          <svg id="keyboard-icon" viewBox="0 0 66 46" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Outer keyboard body with transparent background and stroke color #bfbfbf -->
            <rect x="1" y="1" width="64" height="44" rx="4" ry="4" fill="none" stroke="#bfbfbf" />

            <!-- Row 1 -->
            <rect x="5"  y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="15" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="25" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="35" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="45" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="55" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />

            <!-- Row 2 -->
            <rect x="5"  y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="15" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="25" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="35" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="45" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="55" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />

            <!-- Row 3 -->
            <rect x="5"  y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="15" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="25" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="35" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="45" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
            <rect x="55" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />

            <!-- Spacebar row -->
            <rect x="12" y="35" width="42" height="6" rx="1" fill="#bfbfbf" />
          </svg>
        </div>
        <div class="ts-toggle-option">
          <svg id="toggle-neutral" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80">
            <circle cx="50" cy="50" r="40" fill="#bfbfbf" />
          </svg>
        </div>
        <div class="ts-toggle-option">
          <svg id="mouse-icon" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
            <!-- Mouse body with rounded top and slightly rounded bottom corners -->
            <path d="
              M 20 30 
              Q 20 10, 50 10 
              Q 80 10, 80 30
              L 80 115
              Q 80 125, 70 125
              L 30 125
              Q 20 125, 20 115
              Z
            " />

            <!-- Vertical center line (split buttons) -->
            <line x1="50" y1="10" x2="50" y2="70" />

            <!-- Larger scroll wheel, moved near the top -->
            <line x1="50" y1="30" x2="50" y2="50" stroke-width="8" stroke-linecap="round" />

            <!-- Cable (wire) -->
            <path d="M50 130 C 50 140, 60 145, 70 150" />
          </svg>
        </div>`
      },
      "remote-button-backspace": {
        code: "KEY_BACKSPACE",
        html: 
        `<svg id="backspace-icon" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <!-- Backspace key outline (trapezoid-like shape) -->
          <path d="M8 24 L20 8 H56 V40 H20 Z" />

          <!-- 'X' inside the key (representing delete action) -->
          <line x1="28" y1="18" x2="44" y2="30" />
          <line x1="44" y1="18" x2="28" y2="30" />
        </svg>`
      },
      "foldable-container": {
        tag: "div"
      },
      "remote-button-track-previous": {
        code: "CON_SCAN_PREVIOUS_TRACK", 
        html: 
        `<svg id="previous-track-icon" viewBox="0 4 36 16" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <!-- Vertical bar -->
          <rect x="0" y="4" width="4" height="16" />

          <!-- First left-pointing triangle -->
          <polygon points="18,4 4,12 18,20" />

          <!-- Second left-pointing triangle shifted right by 4 -->
          <polygon points="32,4 18,12 32,20" />
        </svg>`
      },
      "remote-button-play-pause": {
        code: "CON_PLAY_PAUSE", 
        html: 
        `<svg id="play-pause-icon" viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
          <!-- Play triangle -->
          <polygon points="0,4 14,12 0,20" />

          <!-- Pause bars -->
          <rect x="18" y="4" width="4" height="16" />
          <rect x="26" y="4" width="4" height="16" />
        </svg>`
      },
      "remote-button-track-next": {
        code: "CON_SCAN_NEXT_TRACK", 
        html: 
        `<svg id="next-track-icon" viewBox="0 0 44 24" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf">
           <!-- First play triangle shifted left by 4 -->
           <polygon points="0,4 14,12 0,20" />

           <!-- Second play triangle shifted left by 4 -->
           <polygon points="14,4 28,12 14,20" />

           <!-- Vertical bar shifted left by 4 -->
           <rect x="28" y="4" width="4" height="16" />
         </svg>`
      },
      "remote-button-volume-mute": {
        code: "CON_MUTE",
        html: 
        `<svg id="volumemute-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Speaker body (filled) -->
          <path d="M20 24 L28 24 L36 16 V48 L28 40 L20 40 Z" fill="#bfbfbf" />

          <!-- Thinner diagonal line for mute -->
          <line x1="16" y1="16" x2="48" y2="48" stroke="#bfbfbf" stroke-width="2" />
        </svg>`
      },
      "remote-button-volume-down": {
        code: "CON_VOLUME_DECREMENT",
        html: 
        `<svg id="volumedown-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Speaker body (filled) -->
          <path d="M20 24 L28 24 L36 16 V48 L28 40 L20 40 Z" fill="#bfbfbf" />

          <!-- Small volume arc -->
          <path d="M42 26 A6 6 0 0 1 42 38" />
        </svg>`
      },
      "remote-button-volume-up": {
        code: "CON_VOLUME_INCREMENT",
        html: 
        `<svg id="volumeup-icon" viewBox="0 0 64 64"  xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Speaker body with fill -->
          <path d="M16 24 L24 24 L32 16 V48 L24 40 L16 40 Z" fill="#bfbfbf" />

          <!-- Volume arcs (wire view) -->
          <path d="M38 26 A6 6 0 0 1 38 38" />
          <path d="M42 22 A10 10 0 0 1 42 42" />
          <path d="M46 18 A14 14 0 0 1 46 46" />
        </svg>`
      }
    };

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();
    this.pressedConsumers = new Set();

    this.dynamicStyles = new Map();

    // Handle out of bounds mouse releases
    this._handleGlobalPointerUp = this.handleGlobalPointerUp.bind(this);
  }

  setConfig(config) {
    this.config = config;

    // Set log level
    const oldLoglevel = this.loglevel;
    if (config['log_level']) {
      this.loglevel = config['log_level'];
    }

    // Set log pushback
    const oldLogpushback = this.logpushback;
    if (config['log_pushback']) {
      this.logpushback = config['log_pushback'];
    }

    // Update logger when needed
    if (!oldLoglevel || oldLoglevel !== this.loglevel || !oldLogpushback || oldLogpushback !== this.logpushback) {
      this.logger.update(this.loglevel, this._hass, this.logpushback);
    }
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config));

    // Set haptic feedback
    if (config['haptic']) {
      this.eventManager.setHaptic(config['haptic']);
    }

    // Set layout
    if (config['layout']) {
      this.layout = config['layout'];
    }

    // Set layout URL
    if (config['layout_url']) {
      this.layoutUrl = config['layout_url'];
    } else {
      this.layoutUrl = `${Globals.DIR_LAYOUTS}/remote/${this.layout}.json`;
    }

    // Set auto-scroll behavior
    if (config['auto_scroll']) {
      this.autoScroll = config['auto_scroll'];
    } else {
      this.autoScroll = true;
    }

    // Set keyboard configs
    if (config['keyboard']) {
      this.keyboardConfig = config['keyboard'];
    }

    // Set mouse configs
    if (config['mouse']) {
      this.mouseConfig = config['mouse'];
    }

    // Set activites configs
    if (config['activities']) {
      this.activitiesConfig = config['activities'];
    }
  }

  getCardSize() {
    return 4;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Check if layout needs loading
    if (!this._layoutLoaded.layoutUrl || this._layoutLoaded.layoutUrl !== this.layoutUrl) {
      this._layoutReady = false;

      // Load layout
      await this.loadLayout(this.layoutUrl);

      // Update loaded layout
      this._layoutLoaded.layoutUrl = this.layoutUrl;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.resourceManager.synchronizeResources(this._hass);
      this.buildUi(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("loadLayout(layoutUrl):", layoutUrl));
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.rows = layout.rows;
    } catch (e) {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Failed to load remote layout ${layoutUrl}`, e));
      this.rows = {};
    }
  }

  set hass(hass) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("set hass(hass):", hass));
    this._hass = hass;
    this.updateSensors(this._hass);
    if (this._layoutReady && !this._uiBuilt) {
      // Render UI
      this.buildUi(this._hass);
    }
  }

  buildUi(hass) {
    if (this._uiBuilt) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("buildUi(hass) - already built"));
      return;
    }
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("buildUi(hass):", hass));

    // Clear existing content (if any)
    this.shadowRoot.innerHTML = '';

    // Mark UI as "built" to prevent re-enter
    this._uiBuilt = true;

    // Re-add global handlers to ensure proper out-of-bound handling
    this.eventManager.removeGlobalPointerUpHandlers(this._handleGlobalPointerUp);
    this.eventManager.addGlobalPointerUpHandlers(this._handleGlobalPointerUp);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        box-sizing: border-box;
        max-width: 100%;
        background: var(--card-background-color, white);
        border-radius: 0.5em;
        overflow: hidden; /* prevent overflow outside card */
        font-family: sans-serif;
      }

    #main-container {
      --base-font-size: 1rem; /* base scaling unit */
      font-size: var(--base-font-size);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      max-width: 100%;
    }

    .wrapper {
      display: flex;
      flex-direction: column;
    }
    
    .row {
      display: flex;
      flex-direction: row;
      width: 100%;
      flex-wrap: nowrap; /* to keep all items in a row */
      overflow-x: hidden; /* to prevent horizontal scroll */
    }
    .row.gap-top {
      margin-top: clamp(1px, 1vw, 6px);
    }
    .row.gap-bottom {
      margin-bottom: clamp(1px, 1vw, 6px);
    }

    .cell {
      min-width: 0; /* to allow shrinking */
      max-width: 100%;
      padding: clamp(1px, 1vw, 6px);
    }
    .cell.highlight {
      border-bottom-left-radius: 5px;
      border-bottom-right-radius: 5px;
      border-bottom-style: solid;
      border-bottom-width: 2px;
      border-image-outset: 0;
      border-image-repeat: stretch;
      border-image-slice: 100%;
      border-image-source: none;
      border-image-width: 1;
      border-left-color: rgb(155, 80, 0);
      border-left-style: solid;
      border-left-width: 2px;
      border-right-color: rgb(155, 80, 0);
      border-right-style: solid;
      border-right-width: 2px;
      border-top-color: rgb(155, 80, 0);
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
      border-top-style: solid;
      border-top-width: 2px;
      color: rgb(241, 108, 55);
      color-scheme: dark;
    }
    .cell.no-gap {
      padding: 0;
    }

    .standard-grey {
      fill: #bfbfbf;
      stroke: #bfbfbf;
    }
    .highlight-yellow {
      fill: #ffc107;
      stroke: #ffc107;
    }

    .circle-button {
      height: 100%;
      width: 100%;  /* maintain aspect ratio */
      flex: 1 1 0;
      aspect-ratio: 1 / 1;
      background-color: #3a3a3a;
      color: #bfbfbf;
      border: none;
      outline: none;
      cursor: pointer;
      font-family: sans-serif;
      font-size: clamp(1px, 4vw, 24px);
      transition: background-color 0.2s ease;
      align-items: center;
      justify-content: center;
      display: flex;
      border-radius: 50%;   /* This makes the button circular */
    }
    .circle-button:hover { background-color: #4a4a4a; }
    .circle-button:active,
    .circle-button.pressed { transform: scale(0.95); }
    
    .side-button {
      aspect-ratio: 3 / 1;
      width: 100%;  /* maintain aspect ratio */
      flex: 1 1 0;
      background-color: #3a3a3a;
      color: #bfbfbf;
      border: none;
      outline: none;
      cursor: pointer;
      font-family: sans-serif;
      transition: background-color 0.2s ease;
      align-items: center;
      justify-content: center;
      display: flex;
    }
    .side-button.left {
      border-top-left-radius: 999px;
      border-bottom-left-radius: 999px;
    }
    .side-button.right {
      border-top-right-radius: 999px;
      border-bottom-right-radius: 999px;
    }
    .side-button:hover { background-color: #4a4a4a; }
    .side-button:active,
    .side-button.pressed { transform: scale(0.95); }

    .ts-toggle-container {
      min-width: 0;
      text-align: center;
      flex: 1 1 0;
      background-color: #3a3a3a;
      outline: none;
      cursor: pointer;
      font-family: sans-serif;
      transition: background-color 0.2s ease, transform 0.1s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0;
      user-select: none;
      position: relative; /* Needed for absolute children */
    }
    .ts-toggle-option {
      flex: 1 1 0;
      aspect-ratio: 1 / 1;
      max-width: 100%;
      position: relative;
      z-index: 1;
      font-size: clamp(1px, 5vw, 30px);
      color: #bfbfbf;
      border-radius: 999px;
      user-select: none;
      
      display: flex;
      align-items: center;   /* vertical alignment */
      justify-content: center; /* horizontal alignment */
    }
    .ts-toggle-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      width: calc(100% / 3); /* Assuming 3 options */
      left: 0;
      z-index: 0;
      background-color: #4a4a4a;
      border-radius: 999px;
      transition: left 0.3s ease;
    }
    .ts-toggle-option:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .ts-toggle-option.active {
      color: #bfbfbf;
      font-weight: bold;
    }

    .quarter {
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .quarter:hover { opacity: 0.0; }
    text {
      font-family: sans-serif;
      fill: #bfbfbf;
      pointer-events: none;
      user-select: none;
    }

    #foldable-container {
      width: 100%;
      display: none;
    }

    #power-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.4, 0.4);
    }

    #shield-tv-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.6, 0.6);
    }

    #shield-tv-icon-2 {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.6, 0.6);
    }

    #tv-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.6, 0.6);
    }

    #old-tv-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #device-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #arrow-up-icon {
      height: 100%;
      width: auto;
      display: block;
    }

    #arrow-right-icon {
      height: 100%;
      width: auto;
      display: block;
    }

    #arrow-down-icon {
      height: 100%;
      width: auto;
      display: block;
    }

    #arrow-left-icon {
      height: 100%;
      width: auto;
      display: block;
    }

    #return-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.6, 0.6);
    }

    #home-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.6, 0.6);
    }

    #backspace-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.4, 0.4);
    }

    #keyboard-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.4, 0.4);
    }

    #toggle-neutral {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.1, 0.1);
    }

    #mouse-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.4, 0.4) rotate(315deg);
    }

    #settings-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.4, 0.4);
    }

    #previous-track-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #play-pause-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #next-track-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #volumemute-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #volumedown-icon {
      height: 100%;
      width: auto;
      display: block;
      transform: scale(0.5, 0.5);
    }

    #volumeup-icon {
      height: 100%;
      width: auto;  /* maintain aspect ratio */
      display: block; /* removes any inline space */
      transform: scale(0.5, 0.5);
    }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.id = "main-container";
    
    const wrapper = document.createElement('div');
    wrapper.className = "wrapper";
    
    this.rows.forEach((rowConfig, rowIndex) => {
      
      // Create a row
      const row = document.createElement("div");
      row.classList.add('row');
      if (rowConfig["filler-top"]) row.classList.add('gap-top');
      if (rowConfig["filler-bottom"]) row.classList.add('gap-bottom');
      
      // Add cells to row
      rowConfig.cells.forEach((cellConfig, cellIndex) => {

        // Create cell
        const cell = document.createElement("div");
        cell.classList.add('cell');
        cell.classList.add(this.addStyleSpan(style, cellConfig.weight));

        // Remove internal padding on cell when required by the row
        if (rowConfig["no-gap"]) cell.classList.add('no-gap');
        
        // Create cell content
        const cellContent = this.createCellContent(hass, cellConfig);
        
        // Add key element into row
        if (cellContent) cell.appendChild(cellContent);
        row.appendChild(cell);
      });
      
      // Add row into container
      wrapper.appendChild(row);
    });
    
    container.appendChild(wrapper);
    this.shadowRoot.appendChild(container);

    this.card = container;
    this.content = container;

    this.setupDpad(hass);
    this.setupFoldables();

    this.updateSensors(this._hass);
  }

  updateSensors(hass) {
    if (!this.content) return; // Content is not already initialized: skip

    // Override section configured
    if (this.config && this.config['buttons-override']) {
      const buttonsOverride = this.config['buttons-override'];
      
      // Iterate over all override configurations
      Object.keys(buttonsOverride).forEach((btnId) => {
          
        // Search if current override configuration does have a declared sensor
        const btnOverrideConfig = buttonsOverride[btnId];
        const btnOverrideSensor = btnOverrideConfig['sensor'];
        if (btnOverrideSensor) {
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Button-override config ${btnOverrideSensor} detected`));

          // Search if current override configuration matches an element from DOM
          const btn = this.content.querySelector(`#${btnId}`);
          if (btn) {
            
            // The current override configuration does have a declared sensor and matches an element from DOM
            
            // Update sensor state
            if (hass.states[btnOverrideSensor]) {
              btn._sensorState = hass.states[btnOverrideSensor].state;
            } else {
              btn._sensorState = hass.states[btnOverrideSensor];
            }

            // Update children UI states
            if (btn.children) {
              const children = Array.from(btn.children);
              const isOn = btn._sensorState && btn._sensorState === 'on';
              children.forEach(child => {
                if (isOn) {
                  child.classList.add("highlight-yellow");
                } else {
                  child.classList.remove("highlight-yellow");
                }
              });
            }
            if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Sensor state of ${btnOverrideSensor} updated for element ${btnId}:`, btn._sensorState));
          }
        }
      });
    }
  }

  addStyleSpan(style, flex) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("addStyleSpan(style, flex):", style, flex));
    const styleName = this.getStyleSpanName(flex);
    let dynamicStyle = this.dynamicStyles.get(styleName);
    if (!dynamicStyle) {
      dynamicStyle = `
        .${styleName} {
          flex: ${flex};
        }`;
      style.textContent += dynamicStyle;
      this.dynamicStyles.set(styleName, dynamicStyle);
    }
    return styleName;
  }

  getStyleSpanName(flex) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("getStyleSpanName(flex):", flex));
    const flexStr = String(flex);
    const styleId = flexStr.replace(/\./g, '-');
    return `span-${styleId}`;
  }

  createCellContent(hass, cellConfig) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("createCellContent(cellConfig):", cellConfig));

    // Create element inside cell, according to its name
    const cellName = cellConfig.name;
    if (cellName === "filler") return null; // No content for filler cell

    // Retrieve known default config for cell content (when available)
    const knownConfig = this.cellContents[cellName];

    // Retrieve cell content tag
    let cellContentTag = null;
    if (knownConfig && knownConfig.tag) cellContentTag = knownConfig.tag; // Known config
    if (cellConfig.tag) cellContentTag = cellConfig.tag; // User config override
    if (!cellContentTag) cellContentTag = "button"; // Default tag fallback

    // Retrieve cell content style
    let cellContentStyle = null;
    if (knownConfig && knownConfig.style) cellContentStyle = knownConfig.style; // Known config
    if (cellConfig.style) cellContentStyle = cellConfig.style; // User config override
    if (!cellContentStyle && cellContentTag === "button") {
      cellContentStyle = "circle-button"; // Default style fallback (button tag only)
    }

    // Retrieve cell content html
    let cellContentHtml = null;
    if (knownConfig && knownConfig.html) cellContentHtml = knownConfig.html; // Known config
    if (cellConfig.html) cellContentHtml = cellConfig.html; // User config override
    // No default html fallback

    // Build cell content
    let cellContent;
    if (cellContentTag === "svg") {
      cellContent = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    } else {
      cellContent = document.createElement(cellContentTag);
    }
    cellContent.id = cellName;
    if (cellContentStyle) cellContent.className = cellContentStyle;
    if (cellContentHtml) cellContent.innerHTML = cellContentHtml;

    // Add cell content data and event (button tag only)
    if (cellContentTag === "button") this.setDataAndEvents(hass, cellContent);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("created cellContent:", cellContent));

    return cellContent;
  }

  setDataAndEvents(hass, btn) {

    // Retrieve known default config for cell content (when available)
    const knownConfig = this.cellContents[btn.id];

    // Set cell content data
    if (knownConfig && knownConfig.code) {
      btn._keyData = { code: knownConfig.code };
    } else {
      btn._keyData = {};
    }

    // Add pointer Down events:
    this.eventManager.addPointerDownListener(btn, (e) => {
      this.handlePointerDown(e, hass, btn);
    });

    // Add pointer Up events:
    this.eventManager.addPointerUpListener(btn, (e) => {
      this.handlePointerUp(e, hass, btn);
    });
    this.eventManager.addPointerCancelListener(btn, (e) => {
      this.handlePointerUp(e, hass, btn);
    });
  }

  setupDpad(hass) {
    const svg = this.content.querySelector("#dpad");
    const padRadius = 100;
    const padPadding = 56;
    const padLineThick = 5;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;
    const svgSize = padRadius * 2;
    
    svg.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.flex = "4";
    svg.style["aspect-ratio"] = "1 / 1";

    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    svg.appendChild(defs);

    const degToRad = (deg) => (deg * Math.PI) / 180;
    const pointOnCircle = (cx, cy, r, deg) => {
      const rad = degToRad(deg);
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const createQuarterPath = (angleStart) => {
      const angleEnd = (angleStart + 90) % 360;
      const p1 = pointOnCircle(center, center, rOuter, angleStart);
      const p2 = pointOnCircle(center, center, rOuter, angleEnd);
      const p3 = pointOnCircle(center, center, rInner, angleEnd);
      const p4 = pointOnCircle(center, center, rInner, angleStart);

      return `M ${p1.x} ${p1.y}
              A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y}
              L ${p3.x} ${p3.y}
              A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y}
              Z`;
    };

    const quarters = [
      { id: 1, angleStart: 225, keyId: "remote-button-arrow-up" },
      { id: 2, angleStart: 315, keyId: "remote-button-arrow-right" },
      { id: 3, angleStart: 45,  keyId: "remote-button-arrow-down" },
      { id: 4, angleStart: 135, keyId: "remote-button-arrow-left" }
    ];

    const arrowColor = "#bfbfbf";  // ← dynamic color
    const arrowScale = 0.6;          // ← 1 = normal size, <1 = smaller, >1 = larger

    quarters.forEach(({ id, keyId, angleStart }) => {
      const quarterPath = createQuarterPath(angleStart);
      const clipId = `clip-quarter-${id}`;
      const clip = document.createElementNS(ns, "clipPath");
      clip.setAttribute("id", clipId);
      const clipShape = document.createElementNS(ns, "path");
      clipShape.setAttribute("d", quarterPath);
      clip.appendChild(clipShape);
      defs.appendChild(clip);

      const bg = document.createElementNS(ns, "path");
      bg.setAttribute("d", quarterPath);
      bg.setAttribute("fill", "#4a4a4a");
      bg.setAttribute("clip-path", `url(#${clipId})`);
      svg.appendChild(bg);

      const btn = document.createElementNS(ns, "path");
      btn.setAttribute("d", quarterPath);
      btn.setAttribute("fill", "#3a3a3a");
      btn.setAttribute("clip-path", `url(#${clipId})`);
      btn.setAttribute("class", "quarter");
      btn.setAttribute("id", keyId);
      this.setDataAndEvents(hass, btn);
      svg.appendChild(btn);

      // Retrieve arrow content from default config
      const knownConfig = this.cellContents[keyId];
      const arrowContentHtml = knownConfig.html;
      const parser = new DOMParser();
      const doc = parser.parseFromString(arrowContentHtml, "image/svg+xml");
      const arrowSvg = doc.documentElement;

      // Clean ID to avoid duplicate IDs in document
      arrowSvg.removeAttribute("id");

      // Set fill color on inner shapes
      const shapes = arrowSvg.querySelectorAll("path, polygon, circle, rect");
      shapes.forEach(shape => shape.setAttribute("fill", arrowColor));

      // Get the original viewBox
      const vb = arrowSvg.getAttribute("viewBox").split(" ").map(parseFloat);
      const [vbX, vbY, vbWidth, vbHeight] = vb;
      

      // Desired on-screen size (in your SVG coordinate system before scaling)
      const baseSize = 20; // adjust to your taste

      // Scale to fit iconSize in both dimensions
      const scaleX = (baseSize / vbWidth) * arrowScale;
      const scaleY = (baseSize / vbHeight) * arrowScale;

      // Create a group to wrap and position the arrow
      const iconGroup = document.createElementNS(ns, "g");

      // Centered position in D-Pad arc
      const angle = (angleStart + 45) % 360;
      const labelPos = pointOnCircle(center, center, (rOuter + rInner) / 2, angle);

      // Position and center the viewBox origin
      iconGroup.setAttribute(
        "transform",
        `translate(${labelPos.x}, ${labelPos.y}) scale(${scaleX}, ${scaleY}) translate(${-vbX - vbWidth / 2}, ${-vbY - vbHeight / 2})`
      );

      // Move all children of the parsed SVG into the group
      while (arrowSvg.firstChild) {
        iconGroup.appendChild(arrowSvg.firstChild);
      }

      svg.appendChild(iconGroup);
    });

    const centerCircle = document.createElementNS(ns, "circle");
    centerCircle.setAttribute("cx", center);
    centerCircle.setAttribute("cy", center);
    centerCircle.setAttribute("r", centerRadius);
    centerCircle.setAttribute("fill", "#4a4a4a");
    svg.appendChild(centerCircle);

    const centerButton = document.createElementNS(ns, "circle");
    centerButton.setAttribute("cx", center);
    centerButton.setAttribute("cy", center);
    centerButton.setAttribute("r", centerRadius);
    centerButton.setAttribute("fill", "#3a3a3a");
    centerButton.setAttribute("class", "quarter");
    centerButton.setAttribute("id", "remote-button-center");
    this.setDataAndEvents(hass, centerButton);
    svg.appendChild(centerButton);

    const centerLabel = document.createElementNS(ns, "text");
    centerLabel.setAttribute("x", center);
    centerLabel.setAttribute("y", center);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("dominant-baseline", "middle");
    centerLabel.textContent = "OK";
    svg.appendChild(centerLabel);
  }

  setupFoldables() {
    const toggle = this.content.querySelector("#ts-toggle-container");
    const indicator = toggle.querySelector(".ts-toggle-indicator");
    const options = Array.from(toggle.querySelectorAll(".ts-toggle-option"));
    const foldable = this.content.querySelector("#foldable-container");
    const foldableKeyboardName = "android-keyboard-card";
    const foldableActivitiesName = "carrousel-card";
    const foldableMouseName = "trackpad-card";
    let foldableKeyboard;
    let foldableActivites;
    let foldableMouse;

    let state = 1;
    
    const updateFoldable = () => {
      foldable.innerHTML = "";  
      foldable.style.display = "block";
      let foldableContentName;
      if (state === 0) {
        foldableContentName = foldableKeyboardName;
      } else if (state === 1) {
        foldableContentName = foldableActivitiesName;
      } else if (state === 2) {
        foldableContentName = foldableMouseName;
      }
      
      if (foldableContentName) {
        customElements.whenDefined(foldableContentName).then(() => {
          let foldableContent;
          let foldableContentConfig;
          if (foldableContentName === foldableKeyboardName) {
            if (!foldableKeyboard) foldableKeyboard = document.createElement(foldableKeyboardName); // Safe init of imported component
            foldableContent = foldableKeyboard;
            foldableContentConfig = this.keyboardConfig;
          } else if (foldableContentName === foldableActivitiesName) {
            if (!foldableActivites) foldableActivites = document.createElement(foldableActivitiesName); // Safe init of imported component
            foldableContent = foldableActivites;
            foldableContentConfig = this.activitiesConfig;
          } else if (foldableContentName === foldableMouseName) {
            if (!foldableMouse) foldableMouse = document.createElement(foldableMouseName); // Safe init of imported component
            foldableContent = foldableMouse;
            foldableContentConfig = this.mouseConfig;
          } else {
            throw new Error(`Unkwnon foldable component ${foldableContentName}`);
          }
          foldableContent.setAttribute("style", "width: 100%;");
          foldableContent.setConfig(foldableContentConfig);
          foldableContent.hass = this._hass;
          foldable.appendChild(foldableContent);

          // Automatically scroll-down to the added foldable (if autoscroll enabled)
          if (this.autoScroll) {
            setTimeout(() => {
              foldable.scrollIntoView({ behavior: 'smooth' });
            }, 0);
          }
        });
      }
    };

    const updateFoldableUI = () => {
      const leftPercentages = ["0%", "33.33%", "66.66%"];
      indicator.style.left = leftPercentages[state];
    
      options.forEach((opt, idx) => opt.classList.toggle("active", idx === state));
      updateFoldable();
    };


    options.forEach((option, index) => {
      this.eventManager.addPointerClickListener(option, () => {
        if (state !== index) {
          state = index;
          updateFoldableUI();
          this.eventManager.hapticFeedback();
        }
      });
    });
  
    updateFoldableUI();
  }

  handleGlobalPointerUp(evt) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleGlobalPointerUp(evt):", evt));
    if (this.content && this._hass) {
      Object.keys(this.cellContents).forEach((cellConfig) => {
        const cell = this.content.querySelector(`#${cellConfig.id}`);
        if (cell && cell.tagName === 'BUTTON' && cell.classList.contains("active")) {
          this.handleKeyRelease(this._hass, cell);
        }
      });
    }
  }

  handlePointerDown(evt, hass, btn) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    this.handleKeyPress(hass, btn);
  }

  handlePointerUp(evt, hass, btn) {
    evt.preventDefault();
    this.handleKeyRelease(hass, btn);
  }

  // A wrapper for handleKeyPressInternal internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyPress(hass, btn) {
    this.handleKeyPressInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this.eventManager.hapticFeedback();
  }

  handleKeyPressInternal(hass, btn) {
    // Mark button active visually
    btn.classList.add("active");

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    // track the key press to avoid unwanted other key release
    this._currentBaseKey = btn;

    // Pressed key code (keyboard layout independant, later send to remote keyboard)
    const code = keyData.code;
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-pressed:", code));

    if (this.hasOverrideAction(btn)) {
      // Override detected: do nothing (override action will be executed on button up)
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Override detected on key press (suppressed):", btn.id));
    } else {
      // Default action

      // Press HID key
      this.appendCode(hass, code);
    }
  }

  // A wrapper for handleKeyRelease internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyRelease(hass, btn) {
    this.handleKeyReleaseInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this.eventManager.hapticFeedback();
  }

  handleKeyReleaseInternal(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // When the mouse is released over another key than the first pressed key
    if (this._currentBaseKey && this._currentBaseKey._keyData.code !== keyData.code) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-suppressed:", keyData.code, "char:", btn._lowerLabel.textContent || "", "in-favor-of-key:", this._currentBaseKey._keyData.code));
      return; // suppress the unwanted other key release
    }
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-released:", code));

    if (this.hasOverrideAction(btn)) {
      // Override detected: do override action
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Override detected on key release:", btn.id));
      this.executeOverrideAction(btn);
    } else {
      // Default action

      // Release HID key
      this.removeCode(hass, code);
    }
  }
  
  hasOverrideAction(btn) {
    const btnId = btn.id;
    const buttonsOverride = this.config['buttons-override'];
    return (btnId && buttonsOverride && buttonsOverride[btnId]);
  }
  
  executeOverrideAction(btn) {
    const btnId = btn.id;
    const buttonOverrideConfig = this.config['buttons-override'][btnId];

    // Select override action
    let overrideAction;
    if (buttonOverrideConfig['sensor']) {
      if (btn._sensorState && btn._sensorState.toLowerCase() === "on") {
        overrideAction = buttonOverrideConfig['action-when-on'];
      } else {
        overrideAction = buttonOverrideConfig['action-when-off'];
      }
    } else {
      overrideAction = buttonOverrideConfig['action'];
    }

    // Trigger override action
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Triggering override action for:", btnId, overrideAction));
    this.eventManager.triggerHaosTapAction(btn, overrideAction);
  }

  appendCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.appendKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.appendConsumerCode(hass, code);
      } else {
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn("Unknown code type:", code));
      }
    }
  }

  appendKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key pressed:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key pressed
        this.pressedModifiers.add(intCode);
      } else {
        // Standard key pressed
        this.pressedKeys.add(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  appendConsumerCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Consumer pressed:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this.pressedConsumers.add(intCode);
    }
    this.sendConsumerUpdate(hass);
  }

  removeCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.removeKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.removeConsumerCode(hass, code);
      } else {
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn("Unknown code type:", code));
      }
    }
  }

  removeKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key released:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key released
        this.pressedModifiers.delete(intCode);
      } else {
        // Standard key released
        this.pressedKeys.delete(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  removeConsumerCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Consumer released:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this.pressedConsumers.delete(intCode);
    }
    this.sendConsumerUpdate(hass);
  }

  isKey(code) {
    return code && code.startsWith("KEY_");
  }

  isModifier(code) {
    return code && code.startsWith("MOD_");
  }
  
  isConsumer(code) {
    return code && code.startsWith("CON_");
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    this.eventManager.callComponentService(hass, "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }
  
  // Send all current pressed modifiers and keys to HID keyboard
  sendConsumerUpdate(hass) {
    this.eventManager.callComponentService(hass, "conpress", {
      sendCons: Array.from(this.pressedConsumers),
    });
  }

}

customElements.define("android-remote-card", AndroidRemoteCard);
