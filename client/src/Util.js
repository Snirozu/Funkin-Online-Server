import TimeAgo from "javascript-time-ago";
import en from 'javascript-time-ago/locale/en'
import Cookies from 'js-cookie';

TimeAgo.addDefaultLocale(en);
export const timeAgo = new TimeAgo('en-US')
export const moneyFormatter = new Intl.NumberFormat();

export function getResError(response) {
    return response.data ?? 'HTTP ' + response.status;
}

export function ordinalNum(num) {
    if (num % 10 === 1 && num !== 11)
        return num + 'st';
    if (num % 10 === 2 && num !== 12)
        return num + 'nd';
    if (num % 10 === 3 && num !== 13)
        return num + 'rd';
    return num + "th";
}

export function getHost() {
    return "https://funkin.sniro.boo";
    if (window.location.hostname === "localhost") {
        return "http://localhost:" + (process.env.PORT ?? 2567);
    }
    return window.location.protocol + "//" + window.location.host;
}

export function tabButtonColor(hue) {
	if (hue === undefined || hue === null)
		hue = 250;
	return "hsl(" + hue + ",25%,25%)";
}

export function headProfileColor(hue, hue2) {
	if (hue === undefined || hue === null)
		hue = 250;
	if (hue2 || hue2 === 0)
		return 'linear-gradient(0.2turn, hsl(' + hue + ',35%,30%), hsl(' + hue2 + ',40%,25%))';
	return "hsl(" + hue + ",35%,30%)";
}

export function miniProfileColor(hue) {
	if (hue === undefined || hue === null)
		hue = 250;
	return "hsl(" + hue + ",25%,10%)";
}

export function profileBackgroundColor(hue) {
	if (hue === undefined || hue === null)
		hue = 250;
	return "hsl(" + hue + ",45%,6%)";
}

export function clubProfileColor(hue) {
	if (hue === undefined || hue === null)
		hue = 250;
	return "hsl(" + hue + ",25%,15%)";
}


export function contentProfileColor(hue, hue2) {
	if (hue < 0)
		return "#282c34";
	if (hue === undefined || hue === null)
		hue = 250;
	if (hue2 || hue2 === 0)
		return 'linear-gradient(hsl(' + hue + ',35%,20%), hsl(' + hue2 + ',40%,15%))';
	return "hsl(" + hue + ",35%,20%)"
}

export function borderColor(hue, hue2) {
	if (hue === undefined || hue === null)
		hue = 250;
	return "hsl(" + hue + ",20%,30%)";
	// return 'linear-gradient(hsl(' + hue + ',20%,30%), hsl(' + hue2 + ',25%,25%))';

}

export function textProfileColor(hue) {
	if (hue === undefined || hue === null)
		hue = 250;
    return "hsl(" + hue + ",65%,80%)";
}

export function textProfileRow(hue, alt) {
	if (hue === undefined || hue === null)
		hue = 250;
    if (alt)
        return "hsl(" + hue + ",10%,18%)";
    return "hsl(" + hue + ",10%,22%)";
}

export function hasAccess(has) {
	if (!Cookies.get('access_list')) {
		return false;
	}
	for (const perm of Cookies.get('access_list').split(',')) {
		if (matchWildcard(perm, has))
			return true;
	}
	return false; 
}

function matchWildcard(match, to) {
	let isNegative = false;
	if (to.startsWith('!')) {
		isNegative = true;
		to.substring(1);
	}
	let w = match.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`^${w.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
	return re.test(to) !== isNegative;
}

export function returnDate(time) {
	const date = new Date(time);
	return date.getDate() + '/' + (date.getMonth() + 1) + "/" + (date.getFullYear() + "").substring(2);
}

export const allCountries = new Map([
    [null, '(No Country)'],
    ['AF', 'Afghanistan'],
	['AX', 'Aland Islands'],
	['AL', 'Albania'],
	['DZ', 'Algeria'],
	['AS', 'American Samoa'],
	['AD', 'Andorra'],
	['AO', 'Angola'],
	['AI', 'Anguilla'],
	['AG', 'Antigua And Barbuda'],
	['AR', 'Argentina'],
	['AM', 'Armenia'],
	['AW', 'Aruba'],
	['AU', 'Australia'],
	['AT', 'Austria'],
	['AZ', 'Azerbaijan'],
	['BS', 'Bahamas'],
	['BH', 'Bahrain'],
	['BD', 'Bangladesh'],
	['BB', 'Barbados'],
	['BY', 'Belarus'],
	['BE', 'Belgium'],
	['BZ', 'Belize'],
	['BJ', 'Benin'],
	['BM', 'Bermuda'],
	['BT', 'Bhutan'],
	['BO', 'Bolivia'],
	['BA', 'Bosnia And Herzegovina'],
	['BW', 'Botswana'],
	['BV', 'Bouvet Island'],
	['BR', 'Brazil'],
	['IO', 'British Indian Ocean Territory'],
	['BN', 'Brunei Darussalam'],
	['BG', 'Bulgaria'],
	['BF', 'Burkina Faso'],
	['BI', 'Burundi'],
	['KH', 'Cambodia'],
	['CM', 'Cameroon'],
	['CA', 'Canada'],
	['CV', 'Cape Verde'],
	['KY', 'Cayman Islands'],
	['CF', 'Central African Republic'],
	['TD', 'Chad'],
	['CL', 'Chile'],
	['CN', 'China'],
	['CX', 'Christmas Island'],
	['CC', 'Cocos (Keeling) Islands'],
	['CO', 'Colombia'],
	['KM', 'Comoros'],
	['CG', 'Congo'],
	['CD', 'Congo, Democratic Republic'],
	['CK', 'Cook Islands'],
	['CR', 'Costa Rica'],
	['CI', 'Cote D\'Ivoire'],
	['HR', 'Croatia'],
	['CU', 'Cuba'],
	['CY', 'Cyprus'],
	['CZ', 'Czech Republic'],
	['DK', 'Denmark'],
	['DJ', 'Djibouti'],
	['DM', 'Dominica'],
	['DO', 'Dominican Republic'],
	['EC', 'Ecuador'],
	['EG', 'Egypt'],
	['SV', 'El Salvador'],
	['GQ', 'Equatorial Guinea'],
	['ER', 'Eritrea'],
	['EE', 'Estonia'],
	['ET', 'Ethiopia'],
	['FK', 'Falkland Islands (Malvinas)'],
	['FO', 'Faroe Islands'],
	['FJ', 'Fiji'],
	['FI', 'Finland'],
	['FR', 'France'],
	['GF', 'French Guiana'],
	['PF', 'French Polynesia'],
	['TF', 'French Southern Territories'],
	['GA', 'Gabon'],
	['GM', 'Gambia'],
	['GE', 'Georgia'],
	['DE', 'Germany'],
	['GH', 'Ghana'],
	['GI', 'Gibraltar'],
	['GR', 'Greece'],
	['GL', 'Greenland'],
	['GD', 'Grenada'],
	['GP', 'Guadeloupe'],
	['GU', 'Guam'],
	['GT', 'Guatemala'],
	['GG', 'Guernsey'],
	['GN', 'Guinea'],
	['GW', 'Guinea-Bissau'],
	['GY', 'Guyana'],
	['HT', 'Haiti'],
	['HM', 'Heard Island & Mcdonald Islands'],
	['HN', 'Honduras'],
	['HK', 'Hong Kong'],
	['HU', 'Hungary'],
	['IS', 'Iceland'],
	['IN', 'India'],
	['ID', 'Indonesia'],
	['IR', 'Iran, Islamic Republic Of'],
	['IQ', 'Iraq'],
	['IE', 'Ireland'],
	['IM', 'Isle Of Man'],
	['IT', 'Italy'],
	['JM', 'Jamaica'],
	['JP', 'Japan'],
	['JE', 'Jersey'],
	['JO', 'Jordan'],
	['KZ', 'Kazakhstan'],
	['KE', 'Kenya'],
	['KI', 'Kiribati'],
	['KR', 'Korea'],
	['KW', 'Kuwait'],
	['KG', 'Kyrgyzstan'],
	['LA', 'Lao People\'s Democratic Republic'],
	['LV', 'Latvia'],
	['LB', 'Lebanon'],
	['LS', 'Lesotho'],
	['LR', 'Liberia'],
	['LY', 'Libyan Arab Jamahiriya'],
	['LI', 'Liechtenstein'],
	['LT', 'Lithuania'],
	['LU', 'Luxembourg'],
	['MO', 'Macao'],
	['MK', 'Macedonia'],
	['MG', 'Madagascar'],
	['MW', 'Malawi'],
	['MY', 'Malaysia'],
	['MV', 'Maldives'],
	['ML', 'Mali'],
	['MT', 'Malta'],
	['MH', 'Marshall Islands'],
	['MQ', 'Martinique'],
	['MR', 'Mauritania'],
	['MU', 'Mauritius'],
	['YT', 'Mayotte'],
	['MX', 'Mexico'],
	['FM', 'Micronesia, Federated States Of'],
	['MD', 'Moldova'],
	['MC', 'Monaco'],
	['MN', 'Mongolia'],
	['ME', 'Montenegro'],
	['MS', 'Montserrat'],
	['MA', 'Morocco'],
	['MZ', 'Mozambique'],
	['MM', 'Myanmar'],
	['NA', 'Namibia'],
	['NR', 'Nauru'],
	['NP', 'Nepal'],
	['NL', 'Netherlands'],
	['AN', 'Netherlands Antilles'],
	['NC', 'New Caledonia'],
	['NZ', 'New Zealand'],
	['NI', 'Nicaragua'],
	['NE', 'Niger'],
	['NG', 'Nigeria'],
	['NU', 'Niue'],
	['NF', 'Norfolk Island'],
	['MP', 'Northern Mariana Islands'],
	['NO', 'Norway'],
	['OM', 'Oman'],
	['PK', 'Pakistan'],
	['PW', 'Palau'],
	['PS', 'Palestine'],
	['PA', 'Panama'],
	['PG', 'Papua New Guinea'],
	['PY', 'Paraguay'],
	['PE', 'Peru'],
	['PH', 'Philippines'],
	['PN', 'Pitcairn'],
	['PL', 'Poland'],
	['PT', 'Portugal'],
	['PR', 'Puerto Rico'],
	['QA', 'Qatar'],
	['RE', 'Reunion'],
	['RO', 'Romania'],
	['RU', 'Russian Federation'],
	['RW', 'Rwanda'],
	['BL', 'Saint Barthelemy'],
	['SH', 'Saint Helena'],
	['KN', 'Saint Kitts And Nevis'],
	['LC', 'Saint Lucia'],
	['MF', 'Saint Martin'],
	['PM', 'Saint Pierre And Miquelon'],
	['VC', 'Saint Vincent And Grenadines'],
	['WS', 'Samoa'],
	['SM', 'San Marino'],
	['ST', 'Sao Tome And Principe'],
	['SA', 'Saudi Arabia'],
	['SN', 'Senegal'],
	['RS', 'Serbia'],
	['SC', 'Seychelles'],
	['SL', 'Sierra Leone'],
	['SG', 'Singapore'],
	['SK', 'Slovakia'],
	['SI', 'Slovenia'],
	['SB', 'Solomon Islands'],
	['SO', 'Somalia'],
	['ZA', 'South Africa'],
	['GS', 'South Georgia And Sandwich Isl.'],
	['ES', 'Spain'],
	['LK', 'Sri Lanka'],
	['SD', 'Sudan'],
	['SR', 'Suriname'],
	['SJ', 'Svalbard And Jan Mayen'],
	['SZ', 'Swaziland'],
	['SE', 'Sweden'],
	['CH', 'Switzerland'],
	['SY', 'Syrian Arab Republic'],
	['TW', 'Taiwan'],
	['TJ', 'Tajikistan'],
	['TZ', 'Tanzania'],
	['TH', 'Thailand'],
	['TL', 'Timor-Leste'],
	['TG', 'Togo'],
	['TK', 'Tokelau'],
	['TO', 'Tonga'],
	['TT', 'Trinidad And Tobago'],
	['TN', 'Tunisia'],
	['TR', 'Turkey'],
	['TM', 'Turkmenistan'],
	['TC', 'Turks And Caicos Islands'],
	['TV', 'Tuvalu'],
	['UG', 'Uganda'],
	['UA', 'Ukraine'],
	['AE', 'United Arab Emirates'],
	['GB', 'United Kingdom'],
	['US', 'United States'],
	['UM', 'United States Outlying Islands'],
	['UY', 'Uruguay'],
	['UZ', 'Uzbekistan'],
	['VU', 'Vanuatu'],
	['VA', 'Vatican City State'],
	['VE', 'Venezuela'],
	['VN', 'Vietnam'],
	['VG', 'Virgin Islands, British'],
	['VI', 'Virgin Islands, U.S.'],
	['WF', 'Wallis And Futuna'],
	['EH', 'Western Sahara'],
	['YE', 'Yemen'],
	['ZM', 'Zambia'],
	['ZW', 'Zimbabwe']
]);