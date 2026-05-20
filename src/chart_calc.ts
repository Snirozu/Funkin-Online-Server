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

		var window:string = name + 'Window';
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
		var ratingsData:Rating[] = [new Rating('sick')]; //highest rating goes first

		var rating:Rating = new Rating('good');
		rating.ratingMod = 0.67;
		rating.score = 200;
		rating.noteSplash = false;
		ratingsData.push(rating);

		var rating:Rating = new Rating('bad');
		rating.ratingMod = 0.34;
		rating.score = 100;
		rating.noteSplash = false;
		ratingsData.push(rating);

		var rating:Rating = new Rating('shit');
		rating.ratingMod = 0;
		rating.score = 50;
		rating.noteSplash = false;
		ratingsData.push(rating);
		return ratingsData;
	}
}
