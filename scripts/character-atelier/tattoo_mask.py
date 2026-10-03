"""Rasterize facial ink into MakeHuman's skin UVs, without overlay geometry."""
import bpy
import numpy as np

def write_tattoo_mask(body, path, size=2048):
    mesh=body.data
    mesh.calc_loop_triangles()
    uv=mesh.uv_layers.active.data
    height=max(v.co.z for v in mesh.vertices)
    pixels=np.zeros((size,size,4),dtype=np.float32)
    pixels[:,:,:3]=1
    # Broken, tapered sigils leave eyes, lips and the nose free of ink.
    shapes=[[(0,.953),(-.006,.963),(-.010,.987),(.010,.987),(.006,.963)]]
    for side in [-1,1]:
        shapes.append([(side*x,z) for x,z in [(.030,.943),(.038,.943),(.029,.922),(.019,.905),(.022,.922)]])
        shapes.append([(side*x,z) for x,z in [(.017,.968),(.042,.961),(.043,.966),(.019,.973)]])

    def coverage(p):
        x=p[...,0]/height;z=p[...,2]/height
        result=np.zeros(x.shape)
        for shape in shapes:
            inside=np.zeros(x.shape,dtype=bool);distance=np.full(x.shape,1.)
            for a,b in zip(shape,shape[1:]+shape[:1]):
                dx=b[0]-a[0];dz=b[1]-a[1]
                t=np.clip(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1)
                distance=np.minimum(distance,np.sqrt((x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2))
                if dz:
                    inside^=((a[1]>z)!=(b[1]>z)) & (x<(b[0]-a[0])*(z-a[1])/dz+a[0])
            result=np.maximum(result,inside*np.clip(distance/.0007,0,1))
        # Never paint the corresponding back-of-head projection.
        return result*(p[...,1]/height<-.045)

    for triangle in mesh.loop_triangles:
        co=np.array([mesh.vertices[i].co[:] for i in triangle.vertices])
        if co[:,2].max()<height*.90 or co[:,1].min()>-height*.045: continue
        tex=np.array([uv[i].uv[:] for i in triangle.loops])*size
        lo=np.maximum(0,np.floor(tex.min(axis=0)).astype(int));hi=np.minimum(size-1,np.ceil(tex.max(axis=0)).astype(int))
        if np.any(hi<lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        a,b,c=tex;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-8:continue
        w0=((b[1]-c[1])*(xx+.5-c[0])+(c[0]-b[0])*(yy+.5-c[1]))/den
        w1=((c[1]-a[1])*(xx+.5-c[0])+(a[0]-c[0])*(yy+.5-c[1]))/den
        w2=1-w0-w1
        p=w0[...,None]*co[0]+w1[...,None]*co[1]+w2[...,None]*co[2]
        alpha=coverage(p)*((w0>=0)&(w1>=0)&(w2>=0))
        region=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1,3]
        np.maximum(region,alpha,out=region)
    assert np.count_nonzero(pixels[:,:,3])>100, 'Tattoo UV raster is empty'
    image=bpy.data.images.new('Stone sigil tattoo mask',width=size,height=size,alpha=True)
    image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(path);image.file_format='PNG';image.save()
    print('TATTOO MASK',path,flush=True)
