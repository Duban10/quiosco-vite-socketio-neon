import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from '@cloudinary/url-gen';
import { fill } from '@cloudinary/url-gen/actions/resize';
import UploadWidget from './UploadWidget';
import { ImageUp } from 'lucide-react'; // Usaremos un icono de lucide-react

const ImageUpload = ({ onImageUpload, initialImageUrl = '' }) => {
    const [imageUrl, setImageUrl] = useState(initialImageUrl);

    useEffect(() => {
        setImageUrl(initialImageUrl || '');
    }, [initialImageUrl]);

    const cld = useMemo(() => new Cloudinary({
        cloud: {
            cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        }
    }), []);

    const myImage = useMemo(
        () => (imageUrl ? cld.image(imageUrl.split('/').pop().split('.')[0]) : null),
        [cld, imageUrl]
    ); // Extraer public_id de la URL

    const handleImageUpload = useCallback((url) => {
        setImageUrl(url);
        onImageUpload(url); // Pasa la URL al componente padre
    }, [onImageUpload]);

    return (
        <div className='space-y-2'>
            <label htmlFor="" className='text-slate-800'>Imagen Producto</label>
            <div className='relative cursor-pointer hover:opacity-70 transition p-10 border-neutral-300 flex flex-col justify-center items-center gap-4 text-neutral-600 bg-slate-100'>
                <UploadWidget onUpload={handleImageUpload}>
                    {({ open }) => {
                        return (
                            <div onClick={() => open()} className="flex flex-col items-center">
                                <ImageUp size={50} />
                                <p className='text-lg font-semibold'>Agregar imagen</p>
                            </div>
                        );
                    }}
                </UploadWidget>
                {
                    imageUrl && (
                        <div className='absolute inset-0 w-full h-full'>
                            <AdvancedImage
                                cldImg={myImage}
                                plugins={[]}
                                style={{ objectFit: "contain" }}
                            />
                        </div>
                    )
                }
            </div>
            <input type="hidden" value={imageUrl} name='image' />
        </div>
    );
};

export default ImageUpload;
