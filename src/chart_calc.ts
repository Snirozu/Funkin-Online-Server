export class NetSong {
	id:string;
	name:string;
	keys:number;
	length:number;
	notes:any[][]; // [[time, noteData, sustainLength]]
	noteTypes:NetNoteType[];
	speed:number;
	bpm:number;
}

export class NetNoteType {
	name:string;
	ignoreNote:boolean;
	blockHit:boolean;
	hitCausesMiss:boolean;
	lowPriority:boolean;
	ratingDisabled:boolean;
};

export class Rating
{
	public name:string = '';
	public image:string = '';
	public hitWindow:number | null = 0; //ms
	public ratingMod:number = 1;
	public score:number = 350;
	public noteSplash:boolean = true;
	public hits:number = 0;

	constructor(name:string)
	{
		this.name = name;
		this.image = name;
		this.hitWindow = 0;

		const window:string = name + 'Window';
        switch (window) {
            case "sickWindow": 
                this.hitWindow = 45;
                break;
            case "goodWindow":
                this.hitWindow = 90;
                break;
            case "badWindow":
                this.hitWindow = 135;
                break;
        }
	}

	public static loadDefault():Rating[]
	{
		const ratingsData:Rating[] = [new Rating('sick')]; //highest rating goes first

		const rating1:Rating = new Rating('good');
		rating1.ratingMod = 0.67;
		rating1.score = 200;
		rating1.noteSplash = false;
		ratingsData.push(rating1);

		const rating2:Rating = new Rating('bad');
		rating2.ratingMod = 0.34;
		rating2.score = 100;
		rating2.noteSplash = false;
		ratingsData.push(rating2);

		const rating3:Rating = new Rating('shit');
		rating3.ratingMod = 0;
		rating3.score = 50;
		rating3.noteSplash = false;
		ratingsData.push(rating3);
		return ratingsData;
	}
}
