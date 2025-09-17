function AvatarImg(props) {
    var onFailAvatar = (image) => {
        image.currentTarget.src = "/images/bf" + (Math.round(Math.random() + 1)) + ".png";
        //image.currentTarget.src = 'https://kickstarter.funkin.me/static/assets/img/stickers/bf' + (Math.round(Math.random() + 1)) + '.png';
    };

    return (
        <img className={props.className ? props.className : 'Avatar'} onError={onFailAvatar} alt={props.alt} title={props.title} src={props.src} onClick={props.onClick} ></img>
    )
}

export default AvatarImg;