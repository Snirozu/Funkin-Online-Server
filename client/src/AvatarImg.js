function AvatarImg(props) {
    var onFailAvatar = (image) => {
        image.currentTarget.src = "https://raw.githubusercontent.com/FunkinCrew/funkin.assets/a6786b4f37e352356dec86576442a169b01f4d43/shared/images/transitionSwag/stickers-set-1/bfSticker" + (Math.round(Math.random() + 1)) + ".png";
        //image.currentTarget.src = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf' + (Math.round(Math.random() + 1)) + '.png';
    };

    return (
        <img className={props.className ? props.className : 'Avatar'} onError={onFailAvatar} alt='' src={props.src} ></img>
    )
}

export default AvatarImg;