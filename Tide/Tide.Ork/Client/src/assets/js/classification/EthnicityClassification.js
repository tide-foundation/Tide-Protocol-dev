// Tide Protocol - Infrastructure for the Personal Data economy
// Copyright (C) 2019 Tide Foundation Ltd
//
// This program is free software and is subject to the terms of
// the Tide Community Open Source License as published by the
// Tide Foundation Limited. You may modify it and redistribute
// it in accordance with and subject to the terms of that License.
// This program is distributed WITHOUT WARRANTY of any kind,
// including without any implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.
// See the Tide Community Open Source License for more details.
// You should have received a copy of the Tide Community Open
// Source License along with this program.
// If not, see https://tide.org/licenses_tcosl-1-0-en

const rx = /^ethnicity(?:\:(\d))?$/;
export default class EthnicityClassification {
    /**
     * @param {string} type 
     * @returns {boolean}
     */
    static isType(type) { return rx.exec(type) !== null; }

    get fieldType() { return 'select'; }

    /**
     * @param {import('../MetaField').default} field
     * @param {string} type
     */
    constructor(field, type) {
        this.field = field;
        this.level = parseInt(rx.exec(type)[1] || 2);
        if (this.level < 1 || this.level > 2) throw new Error('Level invalid for Ethnicity');
    }

    /** @returns {string} */
    classify() {
        if (this.field.isEncrypted) return null;
        
        if (!this.field.value) return '';

        return this.field.value.slice(0, this.level);
    }

    /** @returns { import('../MetaField').MetaOption[] } */
    options() {
        return [
            { value: '1101', text: 'Australian' },
            { value: '1102', text: 'Australian Aboriginal' },
            { value: '1103', text: 'Australian South Sea Islander' },
            { value: '1104', text: 'Torres Strait Islander' },
            { value: '1201', text: 'Maori' },
            { value: '1202', text: 'New Zealander' },
            { value: '1301', text: 'New Caledonian' },
            { value: '1302', text: 'Ni-Vanuatu' },
            { value: '1303', text: 'Papua New Guinean' },
            { value: '1304', text: 'Solomon Islander' },
            { value: '1399', text: 'Melanesian and Papuan' },
            { value: '1401', text: 'I-Kiribati' },
            { value: '1402', text: 'Nauruan' },
            { value: '1499', text: 'Micronesian' },
            { value: '1501', text: 'Cook Islander' },
            { value: '1502', text: 'Fijian' },
            { value: '1503', text: 'Niuean' },
            { value: '1504', text: 'Samoan' },
            { value: '1505', text: 'Tongan' },
            { value: '1506', text: 'Hawaiian' },
            { value: '1507', text: 'Tahitian' },
            { value: '1508', text: 'Tokelauan' },
            { value: '1511', text: 'Tuvaluan' },
            { value: '1599', text: 'Polynesian' },
            { value: '2101', text: 'English' },
            { value: '2102', text: 'Scottish' },
            { value: '2103', text: 'Welsh' },
            { value: '2104', text: 'Channel Islander' },
            { value: '2105', text: 'Manx' },
            { value: '2199', text: 'British' },
            { value: '2201', text: 'Irish' },
            { value: '2301', text: 'Austrian' },
            { value: '2303', text: 'Dutch' },
            { value: '2304', text: 'Flemish' },
            { value: '2305', text: 'French' },
            { value: '2306', text: 'German' },
            { value: '2307', text: 'Swiss' },
            { value: '2311', text: 'Belgian' },
            { value: '2312', text: 'Frisian' },
            { value: '2313', text: 'Luxembourg' },
            { value: '2399', text: 'Western European' },
            { value: '2401', text: 'Danish' },
            { value: '2402', text: 'Finnish' },
            { value: '2403', text: 'Icelandic' },
            { value: '2404', text: 'Norwegian' },
            { value: '2405', text: 'Swedish' },
            { value: '2499', text: 'Northern European' },
            { value: '3101', text: 'Basque' },
            { value: '3102', text: 'Catalan' },
            { value: '3103', text: 'Italian' },
            { value: '3104', text: 'Maltese' },
            { value: '3105', text: 'Portuguese' },
            { value: '3106', text: 'Spanish' },
            { value: '3107', text: 'Gibraltarian' },
            { value: '3199', text: 'Southern European' },
            { value: '3201', text: 'Albanian' },
            { value: '3202', text: 'Bosnian' },
            { value: '3203', text: 'Bulgarian' },
            { value: '3204', text: 'Croatian' },
            { value: '3205', text: 'Greek' },
            { value: '3206', text: 'Macedonian' },
            { value: '3207', text: 'Moldovan' },
            { value: '3208', text: 'Montenegrin' },
            { value: '3211', text: 'Romanian' },
            { value: '3212', text: 'Roma/Gypsy' },
            { value: '3213', text: 'Serbian' },
            { value: '3214', text: 'Slovene' },
            { value: '3215', text: 'Cypriot' },
            { value: '3216', text: 'Vlach' },
            { value: '3299', text: 'South Eastern European' },
            { value: '3301', text: 'Belarusan' },
            { value: '3302', text: 'Czech' },
            { value: '3303', text: 'Estonian' },
            { value: '3304', text: 'Hungarian' },
            { value: '3305', text: 'Latvian' },
            { value: '3306', text: 'Lithuanian' },
            { value: '3307', text: 'Polish' },
            { value: '3308', text: 'Russian' },
            { value: '3311', text: 'Slovak' },
            { value: '3312', text: 'Ukrainian' },
            { value: '3313', text: 'Sorb/Wend' },
            { value: '3399', text: 'Eastern European' },
            { value: '4101', text: 'Algerian' },
            { value: '4102', text: 'Egyptian' },
            { value: '4103', text: 'Iraqi' },
            { value: '4104', text: 'Jordanian' },
            { value: '4105', text: 'Kuwaiti' },
            { value: '4106', text: 'Lebanese' },
            { value: '4107', text: 'Libyan' },
            { value: '4108', text: 'Moroccan' },
            { value: '4111', text: 'Palestinian' },
            { value: '4112', text: 'Saudi Arabian' },
            { value: '4113', text: 'Syrian' },
            { value: '4114', text: 'Tunisian' },
            { value: '4115', text: 'Yemeni' },
            { value: '4199', text: 'Arab' },
            { value: '4201', text: 'Jewish' },
            { value: '4901', text: 'Assyrian/Chaldean' },
            { value: '4902', text: 'Berber' },
            { value: '4903', text: 'Coptic' },
            { value: '4904', text: 'Iranian' },
            { value: '4905', text: 'Kurdish' },
            { value: '4906', text: 'Sudanese' },
            { value: '4907', text: 'Turkish' },
            { value: '4999', text: 'Other North African and Middle Eastern' },
            { value: '5101', text: 'Anglo-Burmese' },
            { value: '5102', text: 'Burmese' },
            { value: '5103', text: 'Hmong' },
            { value: '5104', text: 'Khmer' },
            { value: '5105', text: 'Lao' },
            { value: '5106', text: 'Thai' },
            { value: '5107', text: 'Vietnamese' },
            { value: '5108', text: 'Karen' },
            { value: '5111', text: 'Mon' },
            { value: '5199', text: 'Mainland South-East Asian' },
            { value: '5201', text: 'Filipino' },
            { value: '5202', text: 'Indonesian' },
            { value: '5203', text: 'Javanese' },
            { value: '5204', text: 'Madurese' },
            { value: '5205', text: 'Malay' },
            { value: '5206', text: 'Sundanese' },
            { value: '5207', text: 'Timorese' },
            { value: '5208', text: 'Acehnese' },
            { value: '5211', text: 'Balinese' },
            { value: '5212', text: 'Bruneian' },
            { value: '5213', text: 'Kadazan' },
            { value: '5214', text: 'Singaporean' },
            { value: '5215', text: 'Temoq' },
            { value: '5299', text: 'Maritime South-East Asian' },
            { value: '6101', text: 'Chinese' },
            { value: '6102', text: 'Taiwanese' },
            { value: '6199', text: 'Chinese Asian' },
            { value: '6901', text: 'Japanese' },
            { value: '6902', text: 'Korean' },
            { value: '6903', text: 'Mongolian' },
            { value: '6904', text: 'Tibetan' },
            { value: '6999', text: 'Other North-East Asian' },
            { value: '7101', text: 'Anglo-Indian' },
            { value: '7102', text: 'Bengali' },
            { value: '7103', text: 'Burgher' },
            { value: '7104', text: 'Gujarati' },
            { value: '7106', text: 'Indian' },
            { value: '7107', text: 'Malayali' },
            { value: '7111', text: 'Nepalese' },
            { value: '7112', text: 'Pakistani' },
            { value: '7113', text: 'Punjabi' },
            { value: '7114', text: 'Sikh' },
            { value: '7115', text: 'Sinhalese' },
            { value: '7116', text: 'Tamil' },
            { value: '7117', text: 'Maldivian' },
            { value: '7199', text: 'Southern Asian' },
            { value: '7201', text: 'Afghan' },
            { value: '7202', text: 'Armenian' },
            { value: '7203', text: 'Georgian' },
            { value: '7204', text: 'Kazakh' },
            { value: '7205', text: 'Pathan' },
            { value: '7206', text: 'Uzbek' },
            { value: '7207', text: 'Azeri' },
            { value: '7208', text: 'Hazara' },
            { value: '7211', text: 'Tajik' },
            { value: '7212', text: 'Tatar' },
            { value: '7213', text: 'Turkmen' },
            { value: '7214', text: 'Uighur' },
            { value: '7299', text: 'Central Asian' },
            { value: '8101', text: 'African American' },
            { value: '8102', text: 'American' },
            { value: '8103', text: 'Canadian' },
            { value: '8104', text: 'French Canadian' },
            { value: '8105', text: 'Hispanic (North American)' },
            { value: '8106', text: 'Native North American Indian' },
            { value: '8107', text: 'Bermudan' },
            { value: '8199', text: 'North American' },
            { value: '8201', text: 'Argentinian' },
            { value: '8202', text: 'Bolivian' },
            { value: '8203', text: 'Brazilian' },
            { value: '8204', text: 'Chilean' },
            { value: '8205', text: 'Colombian' },
            { value: '8206', text: 'Ecuadorian' },
            { value: '8207', text: 'Guyanese' },
            { value: '8208', text: 'Peruvian' },
            { value: '8211', text: 'Uruguayan' },
            { value: '8212', text: 'Venezuelan' },
            { value: '8213', text: 'Paraguayan' },
            { value: '8299', text: 'South American' },
            { value: '8301', text: 'Mexican' },
            { value: '8302', text: 'Nicaraguan' },
            { value: '8303', text: 'Salvadoran' },
            { value: '8304', text: 'Costa Rican' },
            { value: '8305', text: 'Guatemalan' },
            { value: '8306', text: 'Mayan' },
            { value: '8399', text: 'Central American' },
            { value: '8401', text: 'Cuban' },
            { value: '8402', text: 'Jamaican' },
            { value: '8403', text: 'Trinidadian (Tobagonian)' },
            { value: '8404', text: 'Barbadian' },
            { value: '8405', text: 'Puerto Rican' },
            { value: '8499', text: 'Caribbean Islander' },
            { value: '9101', text: 'Akan' },
            { value: '9103', text: 'Ghanaian' },
            { value: '9104', text: 'Nigerian' },
            { value: '9105', text: 'Yoruba' },
            { value: '9106', text: 'Ivorean' },
            { value: '9107', text: 'Liberian' },
            { value: '9108', text: 'Sierra Leonean' },
            { value: '9199', text: 'Central and West African' },
            { value: '9201', text: 'Afrikaner' },
            { value: '9202', text: 'Angolan' },
            { value: '9203', text: 'Eritrean' },
            { value: '9204', text: 'Ethiopian' },
            { value: '9205', text: 'Kenyan' },
            { value: '9206', text: 'Malawian' },
            { value: '9207', text: 'Mauritian' },
            { value: '9208', text: 'Mozambican' },
            { value: '9212', text: 'Oromo' },
            { value: '9213', text: 'Seychellois' },
            { value: '9214', text: 'Somali' },
            { value: '9215', text: 'South African' },
            { value: '9216', text: 'Tanzanian' },
            { value: '9217', text: 'Ugandan' },
            { value: '9218', text: 'Zambian' },
            { value: '9221', text: 'Zimbabwean' },
            { value: '9222', text: 'Amhara' },
            { value: '9223', text: 'Batswana' },
            { value: '9224', text: 'Dinka' },
            { value: '9225', text: 'Hutu' },
            { value: '9226', text: 'Masai' },
            { value: '9227', text: 'Nuer' },
            { value: '9228', text: 'Tigrayan' },
            { value: '9231', text: 'Tigre' },
            { value: '9232', text: 'Zulu' },
            { value: '9299', text: 'Southern and East African' }
        ];
    }
}